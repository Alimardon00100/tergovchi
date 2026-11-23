import type { PrismaClient } from '@prisma/client';

// Existing v1 records intentionally retain null details. Never invent PII.
export async function backfillCaseOpening(db: PrismaClient) {
  const tables = await db.$queryRaw<{ present: boolean }[]>`
    SELECT to_regclass('"CaseOpeningPersonRollback"') IS NOT NULL AS present`;
  if (!tables[0]?.present) return { restored: 0 };
  const restored = await db.$executeRaw`
    UPDATE "Person" AS p SET
      "contactEncrypted" = COALESCE(p."contactEncrypted", b."contactEncrypted"),
      "noteEncrypted" = COALESCE(p."noteEncrypted", b."noteEncrypted")
    FROM "CaseOpeningPersonRollback" AS b
    WHERE p.id = b."personId" AND
      ((p."contactEncrypted" IS NULL AND b."contactEncrypted" IS NOT NULL) OR
       (p."noteEncrypted" IS NULL AND b."noteEncrypted" IS NOT NULL))`;
  return { restored };
}
