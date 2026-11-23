-- Additive only: existing people and v1 responses are preserved.
ALTER TABLE "Person" ADD COLUMN "contactEncrypted" TEXT;
ALTER TABLE "Person" ADD COLUMN "noteEncrypted" TEXT;
