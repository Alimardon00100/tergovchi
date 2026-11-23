import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { LEGAL_ELEMENTS, scoreViewSchema } from '@detective/shared';
import { createApi } from '../../src/http/application';
import { Database } from '../../src/http/database';
import { seedDatabase } from '../../src/infra/seed';
import { seedEnvironmentSchema } from '../../src/infra/seed-config';
import { seedLegalDatabase, LEGAL_SEED_CASES } from '../../src/case-module/seed';
import type { DemoAccount } from '../../src/case-module/seed';

export const firstCase = LEGAL_SEED_CASES[0] ?? '';
export const missingCase = LEGAL_SEED_CASES[2] ?? '';
export const secret = 'case-opening-isolated-test-secret-2026';
export const password = 'Case opening QA passphrase 2026!';
export async function createHarness(web = false) {
  const url = new URL(process.env['DATABASE_URL'] ?? 'http://invalid');
  if (
    !url.pathname.endsWith('_test') ||
    !/^phase0_[a-f0-9]+$/.test(url.searchParams.get('schema') ?? '')
  )
    throw Error('Use the isolated test-database runner');
  const root = resolve('../../.cache');
  await mkdir(root, { recursive: true });
  const temp = await mkdtemp(join(root, 'case-opening-'));
  const app = await createApi({
    secret,
    workspaceId: 'case-opening-qa',
    controlToken: 'qa',
    shutdown: () => undefined,
    mediaDirectory: join(temp, 'uploads'),
    caseFilesDirectory: join(temp, 'case-files'),
    ...(web ? { webDirectory: resolve('../web/dist') } : {}),
  });
  const db = app.get(Database);
  const server = app.getHttpAdapter().getInstance() as FastifyInstance;
  const accounts: DemoAccount[] = (['USER', 'USER', 'ADMIN', 'AUDITOR', 'HEAD'] as const).map(
    (role, i) => ({
      role,
      email: `opening-${i}@example.test`,
      displayName: `Opening ${role} ${i}`,
      password,
    }),
  );
  await seedDatabase(
    db,
    seedEnvironmentSchema.parse({
      DATABASE_URL: url.toString(),
      SEED_ADMIN_EMAIL: 'opening-base@example.test',
      SEED_ADMIN_PASSWORD: password,
    }),
  );
  await seedLegalDatabase(db, { secret, filesDirectory: join(temp, 'case-files'), accounts });
  const names = ['user', 'other', 'admin', 'auditor', 'head'];
  const tokens: Record<string, string> = {},
    ids: Record<string, string> = {};
  for (const [i, account] of accounts.entries()) {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: account.email, password },
    });
    if (response.statusCode !== 201) throw Error('Fixture login failed');
    const body = response.json<{ data: { accessToken: string; user: { id: string } } }>().data;
    tokens[names[i] ?? ''] = body.accessToken;
    ids[names[i] ?? ''] = body.user.id;
  }
  const request = (
    actor: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    payload?: Record<string, unknown>,
    version = 'v1',
  ) =>
    server.inject({
      method,
      url: `/api/${version}${path}`,
      headers: { authorization: 'Bearer ' + tokens[actor] },
      ...(payload ? { payload } : {}),
    });
  return {
    app,
    db,
    server,
    temp,
    tokens,
    ids,
    accounts,
    request,
    async close() {
      await app.close();
      if (temp.startsWith(root + sep)) await rm(temp, { recursive: true, force: true });
    },
  };
}
export type Harness = Awaited<ReturnType<typeof createHarness>>;
export function body<T>(response: { json: <R>() => R }): T {
  return response.json<{ data: T }>().data;
}
export async function saveAnswers(
  h: Harness,
  version: string,
  id = firstCase,
  wrongSubject = false,
) {
  const references = await h.db.referenceAnswer.findMany({ where: { caseId: firstCase } });
  const episodes = await h.db.episode.findMany({
    where: { caseId: id },
    orderBy: { episodeNumber: 'asc' },
  });
  const person = await h.db.casePerson.findFirstOrThrow({ where: { caseId: id, role: 'SUSPECT' } });
  let qualificationId = '';
  for (const episode of episodes)
    for (const elementType of LEGAL_ELEMENTS) {
      const reference = references.find((r) => r.elementType === elementType);
      const payload =
        elementType === 'SUBJECT'
          ? [{ personId: person.personId, role: wrongSubject ? 'YORDAMCHI' : 'IJROCHI' }]
          : reference?.payload;
      const response = await h.request(
        'user',
        'PUT',
        `/cases/${id}/qualification/answers${version === 'v1' ? '/' + elementType : ''}`,
        {
          episodeId: episode.id,
          payload,
          baseVersion: 0,
          ...(version === 'v1' ? {} : { elementType }),
        },
        version,
      );
      if (response.statusCode !== 200) throw Error(response.body);
      qualificationId = body<{ qualificationId: string }>(response).qualificationId;
    }
  return qualificationId;
}
export async function submitAnswers(
  h: Harness,
  version: string,
  qualificationId: string,
  id = firstCase,
) {
  const response = await h.request(
    'user',
    'POST',
    `/cases/${id}/qualification/submit`,
    { qualificationId },
    version,
  );
  return {
    response,
    score: response.statusCode < 300 ? scoreViewSchema.parse(body(response)) : null,
  };
}
