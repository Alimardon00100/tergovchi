import { createCaseBackup, openBackup } from '../src/case-module/backup.service';
import { gunzipSync } from 'node:zlib';
import { seedDatabase } from '../src/infra/seed';
import { seedEnvironmentSchema } from '../src/infra/seed-config';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile, readFile, utimes } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import {
  LEGAL_ELEMENTS,
  casePreviewSchema,
  caseWorkspaceSchema,
  scoreHistorySchema,
} from '@detective/shared';
import { createApi } from '../src/http/application';
import { Database } from '../src/http/database';
import { CaseCrypto } from '../src/case-module/crypto';
import { seedLegalDatabase, LEGAL_SEED_CASES } from '../src/case-module/seed';
import type { DemoAccount } from '../src/case-module/seed';
const url = process.env['TEST_DATABASE_URL'];
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !new URL(url).searchParams.get('schema')?.startsWith('phase0_')
)
  throw Error('Run test:case-module with isolated database');
let app: NestFastifyApplication,
  server: FastifyInstance,
  db: Database,
  temp = '';
const caseId = LEGAL_SEED_CASES[0] ?? '',
  missingId = LEGAL_SEED_CASES[2] ?? '';
const tokens: Record<string, string> = {},
  ids: Record<string, string> = {};
const password = 'Legal QA passphrase 2026!';
const accounts: DemoAccount[] = (
  ['USER', 'USER', 'HEAD', 'PROSECUTOR', 'ADMIN', 'AUDITOR'] as const
).map((role, i) => ({
  role,
  email: `case-qa-${i}@example.test`,
  displayName: `QA ${role} ${i}`,
  password,
}));
const actorNames = ['user', 'user2', 'head', 'prosecutor', 'admin', 'auditor'];
const req = (
  role: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  payload?: unknown,
) =>
  server.inject({
    method,
    url: '/api/v1' + path,
    headers: { authorization: 'Bearer ' + tokens[role] },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
const data = (response: { json: () => unknown }) =>
  (response.json() as { data: Record<string, unknown> }).data;
async function answers(role: string, id: string, wrong = false) {
  const file = data(await req(role, 'GET', `/cases/${id}/workspace`));
  const episodes = file['episodes'] as { id: string }[];
  const people = data(await req(role, 'GET', `/cases/${id}/persons`)) as unknown as {
    id: string;
    role: string;
  }[];
  let qualificationId = '';
  for (const [i, e] of episodes.entries()) {
    const subject = people.find((p) => p.role === (i === 1 ? 'WITNESS' : 'SUSPECT'));
    const payloads = {
      SUBJECT: [{ personId: subject?.id, role: wrong ? 'YORDAMCHI' : 'IJROCHI' }],
      PARTICIPATION: [],
      OBJECT: ['PROPERTY'],
      OBJECTIVE: {
        action: 'HARAKAT',
        consequences: ['MATERIAL'],
        causality: 'MAVJUD',
        note: 'This note is not scored',
      },
      SUBJECTIVE: {
        guilt: 'QASDDAN',
        intent: 'TOGRI',
        motive: 'GREED',
        motiveNote: '',
        purpose: 'ENRICHMENT',
        purposeNote: '',
      },
    };
    for (const element of LEGAL_ELEMENTS) {
      const res = await req(role, 'PUT', `/cases/${id}/qualification/answers/${element}`, {
        episodeId: e.id,
        payload: payloads[element],
        baseVersion: 0,
      });
      expect(res.statusCode, res.body).toBe(200);
      qualificationId = data(res)['qualificationId'] as string;
    }
  }
  return qualificationId;
}
async function open(role: string, id: string) {
  const docs = data(await req(role, 'GET', `/cases/${id}/documents`)) as unknown as {
    signedUrl: string;
  }[];
  const document = docs[0];
  if (!document) throw Error('Seed document absent');
  const res = await server.inject({
    method: 'GET',
    url: document.signedUrl,
    headers: { authorization: 'Bearer ' + tokens[role] },
  });
  expect(res.statusCode, res.body.slice(0, 150)).toBe(200);
  return document.signedUrl;
}
beforeAll(async () => {
  await mkdir(resolve('../../.cache'), { recursive: true });
  temp = await mkdtemp(resolve('../../.cache/case-module-'));
  app = await createApi({
    secret: 'legal-qa-secret-at-least-32-bytes',
    workspaceId: 'case-qa',
    controlToken: 'qa-control',
    shutdown: () => undefined,
    mediaDirectory: join(temp, 'uploads'),
    caseFilesDirectory: join(temp, 'case-files'),
  });
  db = app.get(Database);
  server = app.getHttpAdapter().getInstance() as FastifyInstance;
  await seedDatabase(
    db,
    seedEnvironmentSchema.parse({
      DATABASE_URL: url,
      SEED_ADMIN_EMAIL: 'base-admin@example.test',
      SEED_ADMIN_PASSWORD: password,
    }),
  );
  await seedLegalDatabase(db, {
    secret: 'legal-qa-secret-at-least-32-bytes',
    filesDirectory: join(temp, 'case-files'),
    accounts,
  });
  for (const [i, account] of accounts.entries()) {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: account.email, password },
    });
    expect(res.statusCode, res.body).toBe(201);
    const body = data(res);
    tokens[actorNames[i] ?? ''] = body['accessToken'] as string;
    ids[actorNames[i] ?? ''] = (body['user'] as { id: string }).id;
  }
}, 30000);
afterAll(async () => {
  await app?.close();
  if (temp.startsWith(resolve('../../.cache') + sep))
    await rm(temp, { recursive: true, force: true });
});
describe('Case module REST and policy', () => {
  it('uses Bearer and denies malformed tokens even with a valid cookie', async () => {
    expect((await server.inject({ url: '/api/v1/cases' })).statusCode).toBe(401);
    expect(
      (await server.inject({ url: '/api/v1/cases', headers: { authorization: 'Basic invalid' } }))
        .statusCode,
    ).toBe(401);
  });
  it('previews contain no documents, evidence or persons for every role', async () => {
    for (const role of actorNames) {
      const res = await req(role, 'GET', `/cases/${caseId}`);
      expect(res.statusCode).toBe(200);
      const preview = casePreviewSchema.parse(data(res));
      expect(Object.keys(preview)).not.toContain('documents');
      expect(Object.keys(preview)).not.toContain('persons');
    }
    expect((await req('user', 'GET', `/cases/${caseId}/documents`)).statusCode).toBe(403);
  });
  it('allows only an investigator to take work, serializing two simultaneous claims', async () => {
    for (const role of ['head', 'prosecutor', 'admin', 'auditor'])
      expect((await req(role, 'POST', `/cases/${caseId}/lock`)).statusCode).toBe(403);
    const claims = await Promise.all([
      req('user', 'POST', `/cases/${caseId}/lock`),
      req('user2', 'POST', `/cases/${caseId}/lock`),
    ]);
    expect(claims.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    if (claims[0]?.statusCode !== 201) {
      [tokens['user'], tokens['user2']] = [tokens['user2'] ?? '', tokens['user'] ?? ''];
      [ids['user'], ids['user2']] = [ids['user2'] ?? '', ids['user'] ?? ''];
    }
    expect(data(await req('user', 'GET', `/cases/${caseId}`))['status']).toBe('ASSIGNED');
  });
  it('starts investigation only when the signed file is actually opened', async () => {
    expect((await req('user', 'GET', `/cases/${caseId}/documents`)).statusCode).toBe(200);
    expect(data(await req('user', 'GET', `/cases/${caseId}`))['status']).toBe('ASSIGNED');
    const link = await open('user', caseId);
    expect(data(await req('user', 'GET', `/cases/${caseId}`))['status']).toBe('IN_INVESTIGATION');
    expect(
      (await server.inject({ url: link, headers: { authorization: 'Bearer ' + tokens['user2'] } }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          url: link.replace(/.$/, '!'),
          headers: { authorization: 'Bearer ' + tokens['user'] },
        })
      ).statusCode,
    ).toBe(403);
  });
  it('masks auditor PII and never exposes references to non-admin roles', async () => {
    const rows = data(await req('auditor', 'GET', `/cases/${caseId}/persons`)) as unknown as {
      pinfl: string;
      address: string;
    }[];
    expect(rows[0]?.pinfl).toBe('**********1234');
    expect(rows[0]?.address).toContain('YASHIRILGAN');
    const normal = data(await req('prosecutor', 'GET', `/cases/${caseId}/persons`)) as unknown as {
      pinfl: string;
    }[];
    expect(normal[0]?.pinfl).toBe('00000000001234');
    for (const role of ['user', 'head', 'prosecutor', 'auditor'])
      expect((await req(role, 'GET', `/admin/cases/${caseId}/reference-answers`)).statusCode).toBe(
        403,
      );
    expect((await req('admin', 'GET', `/cases/${caseId}/qualification`)).statusCode).toBe(403);
    expect((await req('auditor', 'GET', `/cases/${caseId}/qualification`)).statusCode).toBe(403);
  });
  it('audits last-write-wins and rejects foreign episode/person IDs', async () => {
    const file = caseWorkspaceSchema.parse(
      data(await req('user', 'GET', `/cases/${caseId}/workspace`)),
    );
    const episodeId = file.episodes[0]?.id;
    const body = { episodeId, payload: ['PROPERTY'], baseVersion: 0 };
    expect(
      (await req('user', 'PUT', `/cases/${caseId}/qualification/answers/OBJECT`, body)).statusCode,
    ).toBe(200);
    const res = await req('user', 'PUT', `/cases/${caseId}/qualification/answers/OBJECT`, body);
    expect(data(res)['conflict']).toBe(true);
    expect(
      (
        await req('user', 'PUT', `/cases/${caseId}/qualification/answers/SUBJECT`, {
          episodeId,
          payload: [{ personId: randomUUID(), role: 'IJROCHI' }],
          baseVersion: 0,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await req('user', 'PUT', `/cases/${caseId}/qualification/answers/OBJECT`, {
          ...body,
          episodeId: randomUUID(),
        })
      ).statusCode,
    ).toBe(400);
    for (const role of ['head', 'prosecutor', 'admin', 'auditor', 'user2'])
      expect(
        (await req(role, 'PUT', `/cases/${caseId}/qualification/answers/OBJECT`, body)).statusCode,
      ).toBeGreaterThanOrEqual(403);
  });
  it('scores 50 when only subject is wrong, allows three attempts and preserves the best', async () => {
    for (let i = 1; i <= 3; i++) {
      const qualificationId = await answers('user', caseId, i !== 2);
      const res = await req('user', 'POST', `/cases/${caseId}/qualification/submit`, {
        qualificationId,
      });
      expect(res.statusCode, res.body).toBe(201);
      expect(data(res)['totalScore']).toBe(i === 2 ? 100 : 50);
      expect(data(res)['attemptNumber']).toBe(i);
      expect(res.body).not.toContain('referenceSnapshot');
    }
    const history = scoreHistorySchema.parse(
      data(await req('user', 'GET', `/cases/${caseId}/score`)),
    );
    expect(history.best).toBe(100);
    expect(history.items).toHaveLength(3);
    const file = caseWorkspaceSchema.parse(
      data(await req('user', 'GET', `/cases/${caseId}/workspace`)),
    );
    expect(file.permissions.canEdit).toBe(false);
    expect(
      (
        await req('user', 'PUT', `/cases/${caseId}/qualification/answers/OBJECT`, {
          episodeId: file.episodes[0]?.id,
          payload: ['PROPERTY'],
          baseVersion: 0,
        })
      ).statusCode,
    ).toBe(409);
    expect((await req('user2', 'GET', `/cases/${caseId}/score`)).statusCode).toBe(403);
  });
  it('exports readable PDF and DOCX, keeps auditor PII masked', async () => {
    const directory = resolve('../../.cache/case-module-qa');
    await mkdir(directory, { recursive: true });
    for (const format of ['pdf', 'docx']) {
      const res = await req('auditor', 'GET', `/cases/${caseId}/export?format=${format}`);
      expect(res.statusCode, res.body.slice(0, 150)).toBe(200);
      expect(res.rawPayload.length).toBeGreaterThan(1000);
      await writeFile(join(directory, 'auditor-report.' + format), res.rawPayload);
    }
  });
  it('requires department head approval to close and makes it immutable', async () => {
    expect((await req('admin', 'POST', `/cases/${caseId}/approve`)).statusCode).toBe(403);
    expect((await req('head', 'POST', `/cases/${caseId}/approve`)).statusCode).toBe(201);
    expect(data(await req('head', 'GET', `/cases/${caseId}`))['status']).toBe('CLOSED');
    expect((await req('user', 'POST', `/cases/${caseId}/lock`)).statusCode).toBe(409);
  });
  it('blocks missing references with 422 and supports renewing an expired lock', async () => {
    await req('user', 'POST', `/cases/${missingId}/lock`);
    await db.caseLock.update({
      where: { caseId: missingId },
      data: { lockedAt: new Date(Date.now() - 86401000), expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await req('user', 'GET', `/cases/${missingId}/workspace`)).statusCode).toBe(200);
    expect((await req('user2', 'POST', `/cases/${missingId}/lock`)).statusCode).toBe(409);
    expect((await req('user', 'POST', `/cases/${missingId}/lock`)).statusCode).toBe(201);
    await open('user', missingId);
    const qualificationId = await answers('user', missingId);
    const res = await req('user', 'POST', `/cases/${missingId}/qualification/submit`, {
      qualificationId,
    });
    expect(res.statusCode, res.body).toBe(422);
  });
  it('head can reassign, suspend and resume; a deadline suspends automatically', async () => {
    expect(
      (
        await req('head', 'POST', `/cases/${missingId}/reassign`, {
          userId: ids['user2'],
          reason: 'Tergovchi almashdi',
        })
      ).statusCode,
    ).toBe(201);
    expect((await req('user', 'GET', `/cases/${missingId}/documents`)).statusCode).toBe(403);
    await req('head', 'POST', `/cases/${missingId}/suspend`, {
      reason: 'Qarorga asosan vaqtincha to‘xtatish',
    });
    expect(data(await req('head', 'GET', `/cases/${missingId}`))['status']).toBe('SUSPENDED');
    expect(
      (
        await req('head', 'POST', `/cases/${missingId}/resume`, {
          deadlineAt: new Date(Date.now() + 86400000).toISOString(),
          reason: 'Ish yurituvi qayta tiklandi',
        })
      ).statusCode,
    ).toBe(201);
    await db.caseFile.update({
      where: { id: missingId },
      data: { openedAt: new Date(Date.now() - 86400000), deadlineAt: new Date(Date.now() - 1000) },
    });
    expect(data(await req('head', 'GET', `/cases/${missingId}`))['status']).toBe('SUSPENDED');
    expect(await db.caseLock.count({ where: { caseId: missingId } })).toBe(0);
  });
  it('rejects expired signed URLs and records no plaintext PII in audit', async () => {
    const doc = await db.caseDocument.findFirstOrThrow({ where: { caseId } });
    const token = app.get(CaseCrypto).sign({
      documentId: doc.id,
      caseId,
      userId: ids['auditor'] ?? '',
      sha256: doc.sha256,
      expires: Date.now() - 1000,
    });
    expect(
      (await req('auditor', 'GET', `/cases/${caseId}/documents/${doc.id}/file?token=${token}`))
        .statusCode,
    ).toBe(403);
    const res = await req('auditor', 'GET', '/audit');
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('00000000001234');
    expect(res.body).not.toContain('Sun’iy ko‘cha');
    expect((await req('user', 'GET', '/audit')).statusCode).toBe(403);
  });
  it('rotates versioned refresh cookies, detects replay and revokes Bearer logout', async () => {
    const credentials = { email: 'api-refresh-' + randomUUID() + '@example.test', password };
    const user = await db.user.upsert({
      where: { email: credentials.email },
      create: {
        email: credentials.email,
        displayName: 'Refresh QA',
        passwordHash: await (await import('bcryptjs')).default.hash(password, 12),
      },
      update: {},
    });
    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: credentials,
    });
    expect(login.statusCode).toBe(201);
    const cookies = (
      Array.isArray(login.headers['set-cookie'])
        ? login.headers['set-cookie']
        : [login.headers['set-cookie'] ?? '']
    )
      .map((v) => v.split(';')[0])
      .join('; ');
    const refreshed = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: cookies },
    });
    expect(refreshed.statusCode).toBe(201);
    const access = data(refreshed)['accessToken'] as string;
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/refresh',
          headers: { cookie: cookies },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          url: '/api/v1/cases',
          headers: { authorization: 'Bearer ' + access },
        })
      ).statusCode,
    ).toBe(401);
    const second = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: credentials,
      }),
      token = data(second)['accessToken'] as string;
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          headers: { authorization: 'Bearer ' + token },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (await server.inject({ url: '/api/v1/cases', headers: { authorization: 'Bearer ' + token } }))
        .statusCode,
    ).toBe(401);
    expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
  });
  it('creates authenticated encrypted backups and retains only eligible files for 30 days', async () => {
    const directory = join(temp, 'backups');
    await mkdir(directory, { recursive: true });
    const old = join(directory, '2025-01-01T00-00-00-000Z-' + randomUUID() + '.case-backup'),
      keep = join(directory, 'keep.txt');
    await writeFile(old, 'old QA backup');
    await writeFile(keep, 'keep');
    await utimes(old, new Date(0), new Date(0));
    await utimes(keep, new Date(0), new Date(0));
    const secret = 'legal-qa-secret-at-least-32-bytes',
      result = await createCaseBackup(db, temp, secret),
      encrypted = await readFile(join(directory, result.filename));
    expect(result.tables).toBeGreaterThan(10);
    expect(encrypted.includes(Buffer.from('QA USER'))).toBe(false);
    expect(() => openBackup(encrypted, 'wrong')).toThrow();
    const archive = gunzipSync(openBackup(encrypted, secret));
    expect(archive.includes(Buffer.from('CaseFile'))).toBe(true);
    expect(archive.includes(Buffer.from('case-files/'))).toBe(true);
    await expect(readFile(old)).rejects.toThrow();
    expect(await readFile(keep, 'utf8')).toBe('keep');
  });
  it('measures local request P95 within acceptance budgets', async () => {
    const measures: Record<string, number[]> = { dashboard: [], workspace: [] };
    for (let i = 0; i < 30; i++)
      for (const [key, path] of Object.entries({
        dashboard: '/cases?page=1',
        workspace: `/cases/${caseId}/workspace`,
      })) {
        const start = performance.now();
        expect((await req('prosecutor', 'GET', path)).statusCode).toBe(200);
        measures[key]?.push(performance.now() - start);
      }
    const p95 = (a: number[]) => a.sort((x, y) => x - y)[Math.ceil(a.length * 0.95) - 1] ?? 0;
    const result = {
      mode: 'Fastify inject, local PostgreSQL, 3 seeded cases, 30 samples',
      dashboardP95: p95(measures['dashboard'] ?? []),
      workspaceP95: p95(measures['workspace'] ?? []),
    };
    expect(result.dashboardP95).toBeLessThan(800);
    expect(result.workspaceP95).toBeLessThan(1200);
    await writeFile(
      resolve('../../.cache/case-module-qa/performance.json'),
      JSON.stringify(result, null, 2),
    );
  });
});
