-- Run transactionally after a verified pg_dump and disabling v2.
-- Preserve v2 data so a later up + backfill can restore it.
CREATE TABLE IF NOT EXISTS "CaseOpeningPersonRollback" (
  "personId" UUID PRIMARY KEY,
  "contactEncrypted" TEXT,
  "noteEncrypted" TEXT
);
INSERT INTO "CaseOpeningPersonRollback" ("personId", "contactEncrypted", "noteEncrypted")
SELECT "id", "contactEncrypted", "noteEncrypted" FROM "Person"
WHERE "contactEncrypted" IS NOT NULL OR "noteEncrypted" IS NOT NULL
ON CONFLICT ("personId") DO UPDATE SET
  "contactEncrypted" = EXCLUDED."contactEncrypted",
  "noteEncrypted" = EXCLUDED."noteEncrypted";
ALTER TABLE "Person" DROP COLUMN "contactEncrypted", DROP COLUMN "noteEncrypted";
