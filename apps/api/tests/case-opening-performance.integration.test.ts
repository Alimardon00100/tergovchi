import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Prisma } from '@prisma/client';
import { createHarness, body, firstCase, saveAnswers, submitAnswers } from './support/case-opening';
import type { Harness } from './support/case-opening';

let h: Harness;
beforeAll(async () => {
  vi.stubEnv('FF_CASE_OPENING_V2', 'true');
  vi.stubEnv('FF_CASE_OPENING_V2_PERCENTAGE', '100');
  h = await createHarness();
}, 30000);
afterAll(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await h?.close();
});
it('keeps thirty local API samples for each acceptance budget, including valid submissions', async () => {
  const measures: Record<string, number[]> = {
    dashboard: [],
    preview: [],
    workspace: [],
    submit: [],
    document: [],
  };
  const budgets: Record<string, number> = {
    dashboard: 800,
    preview: 600,
    workspace: 1200,
    submit: 2000,
    document: 1500,
  };
  await h.request('user', 'POST', `/cases/${firstCase}/lock`, undefined, 'v2');
  const docs = body<{ signedUrl: string }[]>(
    await h.request('user', 'GET', `/cases/${firstCase}/documents`, undefined, 'v2'),
  );
  for (let i = 0; i < 30; i++) {
    for (const [name, path] of Object.entries({
      dashboard: '/cases',
      preview: `/cases/${firstCase}`,
      workspace: `/cases/${firstCase}/workspace`,
    })) {
      const start = performance.now();
      expect((await h.request('user', 'GET', path, undefined, 'v2')).statusCode).toBe(200);
      measures[name]?.push(performance.now() - start);
    }
    const start = performance.now();
    expect(
      (
        await h.server.inject({
          url: docs[0]?.signedUrl ?? '',
          headers: { authorization: 'Bearer ' + h.tokens['user'] },
        })
      ).statusCode,
    ).toBe(200);
    measures['document']?.push(performance.now() - start);
  }
  const reference = await h.db.referenceAnswer.findMany({ where: { caseId: firstCase } });
  const person = await h.db.casePerson.findFirstOrThrow({
    where: { caseId: firstCase, role: 'SUSPECT' },
  });
  const now = Date.now();
  // Each case has the real 3-attempt limit; only the test clock advances between minute windows.
  for (let i = 0; i < 10; i++) {
    vi.spyOn(Date, 'now').mockReturnValue(now + (i + 2) * 61000);
    const file = await h.db.caseFile.create({
      data: {
        caseNumber: `99-2026-${String(i + 1).padStart(3, '0')}`,
        title: 'Synthetic performance case',
        summary: 'Synthetic local performance fixture',
        initialFacts: 'Synthetic fixture without production PII',
        deadlineAt: new Date(now + 86400000),
        createdById: h.ids['admin'] ?? '',
        departmentId: '00000000-0000-4000-8000-000000000001',
        jkArticles: ['169'],
        referenceRevision: 1,
        persons: { create: { personId: person.personId, role: 'SUSPECT' } },
        episodes: {
          create: {
            episodeNumber: 1,
            description: 'Synthetic episode',
            jkArticle: '169',
            location: 'Synthetic location',
            dateTime: new Date(now),
            weight: 1,
          },
        },
      },
      include: { episodes: true },
    });
    const episodeId = file.episodes[0]?.id ?? '';
    for (const row of reference)
      await h.db.referenceAnswer.create({
        data: {
          caseId: file.id,
          episodeId,
          elementType: row.elementType,
          weight: row.weight,
          payload: JSON.parse(JSON.stringify(row.payload)) as Prisma.InputJsonValue,
        },
      });
    await h.request('user', 'POST', `/cases/${file.id}/lock`, undefined, 'v2');
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = await saveAnswers(h, 'v2', file.id);
      const start = performance.now(),
        result = await submitAnswers(h, 'v2', id, file.id);
      expect(result.response.statusCode, result.response.body).toBe(200);
      expect(result.score?.totalScore).toBe(100);
      measures['submit']?.push(performance.now() - start);
    }
  }
  const results = Object.fromEntries(
    Object.entries(measures).map(([name, values]) => {
      expect(values).toHaveLength(30);
      const p95 = [...values].sort((a, b) => a - b)[28] ?? Infinity;
      expect(p95, name).toBeLessThan(budgets[name] ?? 0);
      return [name, { samples: values.length, p95Ms: p95, budgetMs: budgets[name] }];
    }),
  );
  const directory = resolve('../../.cache/case-opening-v2-qa');
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, 'performance.json'),
    JSON.stringify(
      {
        mode: 'Local Fastify inject and isolated PostgreSQL; API time only, sequential requests, 30 samples; not browser or production load',
        results,
      },
      null,
      2,
    ),
  );
}, 30000);
