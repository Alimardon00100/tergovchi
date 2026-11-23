import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHarness, secret } from './support/case-opening';
import type { Harness } from './support/case-opening';
import { CaseCrypto } from '../src/case-module/crypto';
import { backfillCaseOpening } from '../src/case-module/backfill';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
}, 30000);
afterAll(async () => {
  await h?.close();
});
it('round-trips additive up/down, preserves encrypted values and never alters legacy data', async () => {
  const crypto = new CaseCrypto({
    secret,
    workspaceId: 'qa',
    controlToken: 'qa',
    shutdown: () => undefined,
  });
  const person = await h.db.person.findFirstOrThrow();
  const originalAddress = person.addressEncrypted;
  const counts = {
    people: await h.db.person.count(),
    cases: await h.db.caseFile.count(),
    oldCases: await h.db.case.count(),
  };
  const encrypted = crypto.encrypt('Synthetic contact');
  await h.db.person.update({
    where: { id: person.id },
    data: { contactEncrypted: encrypted, noteEncrypted: crypto.encrypt('Synthetic note') },
  });
  const down = await readFile('prisma/rollbacks/202611230001_case_opening_v2.sql', 'utf8');
  await h.db.$transaction(async (tx) => {
    for (const statement of down.split(';').filter((s) => s.trim()))
      await tx.$executeRawUnsafe(statement);
  });
  const backups = await h.db.$queryRaw<
    { contactEncrypted: string }[]
  >`SELECT "contactEncrypted" FROM "CaseOpeningPersonRollback" WHERE "personId"=${person.id}::uuid`;
  expect(backups[0]?.contactEncrypted).toBe(encrypted);
  const up = await readFile('prisma/migrations/202611230001_case_opening_v2/migration.sql', 'utf8');
  await h.db.$transaction(async (tx) => {
    for (const statement of up.split(';').filter((s) => s.trim()))
      await tx.$executeRawUnsafe(statement);
  });
  expect(await backfillCaseOpening(h.db)).toEqual({ restored: 1 });
  expect(await backfillCaseOpening(h.db)).toEqual({ restored: 0 });
  const restored = await h.db.person.findUniqueOrThrow({ where: { id: person.id } });
  expect(crypto.decrypt(restored.contactEncrypted ?? '')).toBe('Synthetic contact');
  expect(crypto.decrypt(restored.noteEncrypted ?? '')).toBe('Synthetic note');
  expect(restored.addressEncrypted).toBe(originalAddress);
  expect({
    people: await h.db.person.count(),
    cases: await h.db.caseFile.count(),
    oldCases: await h.db.case.count(),
  }).toEqual(counts);
});
