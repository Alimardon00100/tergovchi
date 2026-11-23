import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { documentsV2Schema, personsV2Schema, casePreviewSchema } from '@detective/shared';
import {
  createHarness,
  body,
  firstCase,
  missingCase,
  saveAnswers,
  submitAnswers,
} from './support/case-opening';
import type { Harness } from './support/case-opening';

let h: Harness;
let personId = '';
beforeAll(async () => {
  h = await createHarness();
}, 30000);
beforeEach(() => {
  vi.stubEnv('FF_CASE_OPENING_V2', 'true');
  vi.stubEnv('FF_CASE_OPENING_V2_PERCENTAGE', '100');
});
afterAll(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await h?.close();
});
const get = (actor: string, path: string) => h.request(actor, 'GET', path, undefined, 'v2');
describe('Case opening v2 policy and parity', () => {
  it('defaults to the legacy contract when disabled and rejects direct v2 access', async () => {
    vi.stubEnv('FF_CASE_OPENING_V2', 'false');
    expect((await get('user', `/cases/${firstCase}`)).statusCode).toBe(404);
    expect((await h.request('user', 'GET', `/cases/${firstCase}`)).statusCode).toBe(200);
    expect(body(await h.request('user', 'GET', '/config', undefined, 'case-opening'))).toEqual({
      enabled: false,
    });
  });
  it('has exact preview parity and never returns materials to any role', async () => {
    for (const actor of ['user', 'other', 'admin', 'auditor', 'head']) {
      const v1 = await h.request(actor, 'GET', `/cases/${firstCase}`);
      const v2 = await get(actor, `/cases/${firstCase}`);
      expect(v2.statusCode).toBe(200);
      expect(body(v2)).toEqual(body(v1));
      const preview = casePreviewSchema.parse(body(v2));
      expect(Object.keys(preview)).not.toContain('documents');
      expect(Object.keys(preview)).not.toContain('persons');
    }
    expect((await get('user', '/cases/' + randomUUID())).statusCode).toBe(404);
    expect((await get('user', '/cases/invalid')).statusCode).toBe(400);
    expect((await h.server.inject({ url: '/api/v2/cases' })).statusCode).toBe(401);
  });
  it('adds optional encrypted details through admin only while retaining exact v1 person DTOs', async () => {
    const input = {
      fullName: 'Synthetic details',
      birthDate: '2000-01-01',
      gender: 'MALE',
      address: 'Synthetic address',
      role: 'OTHER',
      contact: 'Synthetic contact',
      note: 'Synthetic private note',
    };
    expect(
      (await h.request('user', 'POST', `/cases/${missingCase}/persons`, input, 'v2')).statusCode,
    ).toBe(403);
    const response = await h.request('admin', 'POST', `/cases/${missingCase}/persons`, input, 'v2');
    expect(response.statusCode).toBe(201);
    personId = body<{ id: string }>(response).id;
    const stored = await h.db.person.findUniqueOrThrow({ where: { id: personId } });
    expect(stored.contactEncrypted).not.toContain('Synthetic');
    const people = personsV2Schema.parse(body(await get('admin', `/cases/${missingCase}/persons`)));
    expect(people.find((p) => p.id === personId)).toMatchObject({
      contact: input.contact,
      note: input.note,
    });
    const masked = personsV2Schema.parse(
      body(await get('auditor', `/cases/${missingCase}/persons`)),
    );
    expect(masked.find((p) => p.id === personId)).toMatchObject({
      contact: '[YASHIRILGAN]',
      note: '[YASHIRILGAN]',
    });
    const legacy = body<Record<string, unknown>[]>(
      await h.request('admin', 'GET', `/cases/${missingCase}/persons`),
    );
    expect(people.map((p) => ({ ...p, contact: undefined, note: undefined }))).toEqual(
      legacy.map((p) => ({ ...p, contact: undefined, note: undefined })),
    );
  });
  it('serializes a two-investigator race with exactly 200/409 and audits ownership', async () => {
    const responses = await Promise.all(
      ['user', 'other'].map((actor) =>
        h.request(actor, 'POST', `/cases/${firstCase}/lock`, undefined, 'v2'),
      ),
    );
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    if (responses[0]?.statusCode !== 200) {
      [h.tokens['user'], h.tokens['other']] = [h.tokens['other'] ?? '', h.tokens['user'] ?? ''];
      [h.ids['user'], h.ids['other']] = [h.ids['other'] ?? '', h.ids['user'] ?? ''];
    }
    expect(body(await get('user', `/cases/${firstCase}`))).toMatchObject({ status: 'ASSIGNED' });
    expect(
      await h.db.auditLog.count({ where: { action: 'LEGAL_LOCK_ACQUIRED', targetId: firstCase } }),
    ).toBe(1);
  });
  it('allows documents and evidence only to the current lock owner, including signed file requests', async () => {
    for (const actor of ['other', 'admin', 'auditor', 'head'])
      expect((await get(actor, `/cases/${firstCase}/documents`)).statusCode).toBe(403);
    const docs = documentsV2Schema.parse(body(await get('user', `/cases/${firstCase}/documents`)));
    const doc = docs[0];
    expect(doc?.isEvidence).toBe(true);
    expect(
      (
        await h.server.inject({
          url: (doc?.signedUrl ?? '').replace('/api/v2/', '/api/v1/'),
          headers: { authorization: 'Bearer ' + h.tokens['user'] },
        })
      ).statusCode,
    ).toBe(403);
    expect(Date.parse(doc?.expiresAt ?? '') - Date.now()).toBeGreaterThan(890000);
    expect(
      (
        await h.server.inject({
          url: doc?.signedUrl ?? '',
          headers: { authorization: 'Bearer ' + h.tokens['other'] },
        })
      ).statusCode,
    ).toBe(403);
    await h.db.caseLock.update({
      where: { caseId: firstCase },
      data: { expiresAt: new Date(Date.now() - 1), lockedAt: new Date(Date.now() - 86400000) },
    });
    expect((await get('user', `/cases/${firstCase}/documents`)).statusCode).toBe(409);
    expect(
      (
        await h.server.inject({
          url: doc?.signedUrl ?? '',
          headers: { authorization: 'Bearer ' + h.tokens['user'] },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await h.request('user', 'POST', `/cases/${firstCase}/lock`, undefined, 'v2')).statusCode,
    ).toBe(200);
  });
  it('saves directly after claim, rejects bad IDs/long notes and reports a lost lock', async () => {
    const episode = await h.db.episode.findFirstOrThrow({ where: { caseId: firstCase } });
    const input = {
      episodeId: episode.id,
      elementType: 'OBJECT',
      payload: ['PROPERTY'],
      baseVersion: 0,
    };
    expect(
      (
        await h.request(
          'user',
          'PUT',
          `/cases/${firstCase}/qualification/answers`,
          { ...input, episodeId: randomUUID() },
          'v2',
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await h.request(
          'user',
          'PUT',
          `/cases/${firstCase}/qualification/answers`,
          {
            ...input,
            elementType: 'OBJECTIVE',
            payload: {
              action: 'HARAKAT',
              consequences: ['MATERIAL'],
              causality: 'MAVJUD',
              note: 'x'.repeat(2001),
            },
          },
          'v2',
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (await h.request('user', 'PUT', `/cases/${firstCase}/qualification/answers`, input, 'v2'))
        .statusCode,
    ).toBe(200);
    expect(body(await get('user', `/cases/${firstCase}`))).toMatchObject({
      status: 'IN_INVESTIGATION',
    });
    await h.request('user', 'DELETE', `/cases/${firstCase}/lock`, undefined, 'v2');
    expect(
      (await h.request('user', 'PUT', `/cases/${firstCase}/qualification/answers`, input, 'v2'))
        .statusCode,
    ).toBe(409);
    await h.request('user', 'POST', `/cases/${firstCase}/lock`, undefined, 'v2');
  });
  it('blocks missing references, restricts etalons to admin and preserves revision history', async () => {
    await h.request('user', 'POST', `/cases/${missingCase}/lock`, undefined, 'v2');
    const qualificationId = await saveAnswers(h, 'v2', missingCase);
    const result = await submitAnswers(h, 'v2', qualificationId, missingCase);
    expect(result.response.statusCode).toBe(422);
    for (const actor of ['user', 'other', 'head', 'auditor'])
      expect((await get(actor, `/admin/cases/${firstCase}/reference-answers`)).statusCode).toBe(
        403,
      );
    const references = await get('admin', `/admin/cases/${firstCase}/reference-answers`);
    expect(body(references)).toEqual(
      body(await h.request('admin', 'GET', `/admin/cases/${firstCase}/reference-answers`)),
    );
    // Move only the rate-limit clock beyond this test's one failed submit.
    const now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now + 61000);
  });
  it('scores 50 independently, keeps three attempts and rate-limits a fourth submit', async () => {
    for (const [index, wrong] of [true, false, true].entries()) {
      const id = await saveAnswers(h, 'v2', firstCase, wrong);
      const { response, score } = await submitAnswers(h, 'v2', id);
      expect(response.statusCode, response.body).toBe(200);
      expect(score).toMatchObject({ totalScore: wrong ? 50 : 100, attemptNumber: index + 1 });
    }
    const history = await get('user', `/cases/${firstCase}/score`);
    expect(body(history)).toEqual(
      body(await h.request('user', 'GET', `/cases/${firstCase}/score`)),
    );
    expect(body(history)).toMatchObject({ best: 100, attemptsUsed: 3 });
    expect(
      (
        await h.request(
          'user',
          'POST',
          `/cases/${firstCase}/qualification/submit`,
          { qualificationId: randomUUID() },
          'v2',
        )
      ).statusCode,
    ).toBe(429);
    expect(
      body<{ permissions: { canEdit: boolean } }>(
        await get('user', `/cases/${firstCase}/workspace`),
      ).permissions.canEdit,
    ).toBe(false);
    vi.restoreAllMocks();
  });
  it('records tab visits without plaintext PII and retains list/workspace parity', async () => {
    const response = await h.request(
      'user',
      'POST',
      '/events',
      { caseId: firstCase, tab: 'results' },
      'case-opening',
    );
    expect(response.statusCode).toBe(201);
    const visits = await h.db.auditLog.findMany({ where: { action: 'LEGAL_TAB_VISITED' } });
    expect(visits).toHaveLength(1);
    expect(JSON.stringify(visits)).not.toContain('Synthetic contact');
    expect(body(await get('user', `/cases/${firstCase}/workspace`))).toMatchObject({
      case: body(await get('user', `/cases/${firstCase}`)),
    });
    const v1 = body<{ items: unknown[] }>(await h.request('user', 'GET', '/cases'));
    const v2 = body<{ items: unknown[] }>(await get('user', '/cases'));
    expect(v2.items).toEqual(v1.items);
  });
});
