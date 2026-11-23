import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import {
  casePreviewSchema,
  caseWorkspaceSchema,
  documentsSchema,
  personsSchema,
} from '@detective/shared';
import {
  createHarness,
  body,
  firstCase,
  saveAnswers,
  submitAnswers,
} from '../support/case-opening';
import type { Harness } from '../support/case-opening';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
}, 30000);
afterAll(async () => {
  await h?.close();
});
describe('Case Opening — immutable v1 characterization', () => {
  it('preview has the established exact metadata contract and hides all materials', async () => {
    const response = await h.request('user', 'GET', `/cases/${firstCase}`);
    expect(response.statusCode).toBe(200);
    const preview = casePreviewSchema.parse(body(response));
    expect(Object.keys(preview).sort()).toEqual(
      [
        'assignee',
        'blockReason',
        'canEnter',
        'canTake',
        'caseNumber',
        'closedAt',
        'deadlineAt',
        'department',
        'episodeCount',
        'id',
        'initialFacts',
        'jkArticles',
        'lock',
        'openedAt',
        'status',
        'summary',
        'title',
      ].sort(),
    );
    expect(preview).toMatchObject({
      caseNumber: '1-2026-001',
      title: 'Omborxonadagi izlar',
      jkArticles: ['169'],
      status: 'NEW',
      lock: null,
      canTake: true,
      canEnter: false,
    });
    expect((await h.request('user', 'GET', `/cases/${firstCase}/documents`)).statusCode).toBe(403);
  });
  it('claim returns 201, serializes ownership and grants a 24-hour lock', async () => {
    const response = await h.request('user', 'POST', `/cases/${firstCase}/lock`);
    expect(response.statusCode).toBe(201);
    const preview = casePreviewSchema.parse(body(response));
    expect(preview.status).toBe('ASSIGNED');
    expect(preview.lock?.lockedBy).toBe(h.ids['user']);
    expect(
      Date.parse(preview.lock?.expiresAt ?? '') - Date.parse(preview.lock?.lockedAt ?? ''),
    ).toBe(86400000);
    expect((await h.request('other', 'POST', `/cases/${firstCase}/lock`)).statusCode).toBe(409);
  });
  it('workspace and document listing keep ASSIGNED until a signed file is opened', async () => {
    const workspace = caseWorkspaceSchema.parse(
      body(await h.request('user', 'GET', `/cases/${firstCase}/workspace`)),
    );
    expect(workspace).toMatchObject({
      attemptsUsed: 0,
      referenceReady: true,
      permissions: { canEdit: true },
      case: { status: 'ASSIGNED' },
    });
    const docs = documentsSchema.parse(
      body(await h.request('user', 'GET', `/cases/${firstCase}/documents`)),
    );
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ type: 'PROTOCOL', isEvidence: true, mime: 'application/pdf' });
    const response = await h.server.inject({
      url: docs[0]?.signedUrl ?? '',
      headers: { authorization: 'Bearer ' + h.tokens['user'] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(
      body<{ status: string }>(await h.request('user', 'GET', `/cases/${firstCase}`)).status,
    ).toBe('IN_INVESTIGATION');
  });
  it('v1 person DTO contains no new fields and masks auditor PII', async () => {
    const people = personsSchema.parse(
      body(await h.request('auditor', 'GET', `/cases/${firstCase}/persons`)),
    );
    expect(Object.keys(people[0] ?? {}).sort()).toEqual(
      [
        'address',
        'birthDate',
        'fullName',
        'gender',
        'id',
        'masked',
        'photoUrl',
        'pinfl',
        'role',
      ].sort(),
    );
    expect(people[0]).toMatchObject({
      pinfl: '**********1234',
      address: '[MANZIL YASHIRILGAN]',
      masked: true,
    });
  });
  it('submit scores subject independently, returns 201 and preserves the best of three', async () => {
    for (const wrong of [true, false, true]) {
      const id = await saveAnswers(h, 'v1', firstCase, wrong);
      const { response, score } = await submitAnswers(h, 'v1', id);
      expect(response.statusCode).toBe(201);
      expect(score?.totalScore).toBe(wrong ? 50 : 100);
      expect(response.body).not.toContain('referenceSnapshot');
    }
    expect(body(await h.request('user', 'GET', `/cases/${firstCase}/score`))).toMatchObject({
      best: 100,
      attemptsUsed: 3,
      maxAttempts: 3,
    });
    expect(
      (
        await h.request('user', 'PUT', `/cases/${firstCase}/qualification/answers/OBJECT`, {
          episodeId: '63200000-0000-4000-8000-000000000011',
          payload: ['PROPERTY'],
          baseVersion: 0,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('v1 privileged document access remains available without ownership', async () => {
    await h.request('user', 'DELETE', `/cases/${firstCase}/lock`);
    expect((await h.request('admin', 'GET', `/cases/${firstCase}/documents`)).statusCode).toBe(200);
  });
});
