-- DECISION: Prisma ifodalay olmaydigan invariantlar versiyalangan SQL bilan saqlanadi.
ALTER TABLE "User" ADD CONSTRAINT "User_points_nonnegative" CHECK ("points" >= 0);
ALTER TABLE "User" ADD CONSTRAINT "User_display_name_valid" CHECK (char_length(btrim("displayName")) BETWEEN 2 AND 80);
ALTER TABLE "RankConfig" ADD CONSTRAINT "RankConfig_min_points_valid" CHECK ("minPoints" >= 0);
ALTER TABLE "RankConfig" ADD CONSTRAINT "RankConfig_order_valid" CHECK ("displayOrder" BETWEEN 0 AND 9);
ALTER TABLE "Case" ADD CONSTRAINT "Case_base_points_match_difficulty" CHECK (
  ("difficulty" = 'EASY' AND "basePoints" = 20) OR
  ("difficulty" = 'MEDIUM' AND "basePoints" = 30) OR
  ("difficulty" = 'HARD' AND "basePoints" = 50)
);
ALTER TABLE "Case" ADD CONSTRAINT "Case_custom_points_nonnegative" CHECK ("customPoints" IS NULL OR "customPoints" >= 0);
ALTER TABLE "Case" ADD CONSTRAINT "Case_slug_valid" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_content_valid" CHECK (
  ("type" = 'TEXT' AND "content" IS NOT NULL AND char_length(btrim("content")) > 0 AND "assetKey" IS NULL) OR
  ("type" IN ('IMAGE', 'DOCUMENT') AND "content" IS NULL AND "assetKey" IS NOT NULL AND char_length(btrim("assetKey")) > 0)
);
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_order_valid" CHECK ("displayOrder" >= 0);
ALTER TABLE "UserCaseProgress" ADD CONSTRAINT "UserCaseProgress_points_nonnegative" CHECK ("awardedPoints" >= 0);
ALTER TABLE "UserCaseProgress" ADD CONSTRAINT "UserCaseProgress_closure_valid" CHECK (
  ("status" = 'IN_PROGRESS' AND "closedAt" IS NULL) OR
  ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedAt" >= "openedAt")
);
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_balance_nonnegative" CHECK ("balanceAfter" >= 0);
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_source_valid" CHECK (
  ("type" = 'CASE_OPEN' AND "caseId" IS NOT NULL AND "amount" >= 0) OR
  ("type" = 'ADMIN_ADJUSTMENT' AND "caseId" IS NULL AND "amount" <> 0)
);
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_hash_valid" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_expiry_valid" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_rotation_valid" CHECK (
  "replacedById" IS NULL OR ("replacedById" <> "id" AND "revokedAt" IS NOT NULL)
);
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_metadata_object" CHECK (jsonb_typeof("metadata") = 'object');

CREATE FUNCTION "sync_user_identity"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE resolved "RankName";
BEGIN
  NEW."email" := lower(btrim(NEW."email"));
  IF NEW."points" < 0 THEN
    RAISE EXCEPTION 'Ball manfiy bo‘la olmaydi' USING ERRCODE = '23514';
  END IF;
  SELECT "name" INTO resolved FROM "RankConfig"
    WHERE "minPoints" <= NEW."points" ORDER BY "minPoints" DESC LIMIT 1;
  IF resolved IS NULL THEN
    RAISE EXCEPTION 'Boshlang‘ich unvon mavjud emas' USING ERRCODE = '23514';
  END IF;
  NEW."rankName" := resolved;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "User_sync_identity" BEFORE INSERT OR UPDATE OF "points", "rankName", "email"
  ON "User" FOR EACH ROW EXECUTE FUNCTION "sync_user_identity"();

CREATE FUNCTION "check_rank_configuration"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invalid boolean;
BEGIN
  IF (SELECT count(*) FROM "RankConfig") <> 10 THEN
    RAISE EXCEPTION 'O‘nta unvon konfiguratsiyasi talab qilinadi' USING ERRCODE = '23514';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT "name", "minPoints", "displayOrder", row_number() OVER (ORDER BY "displayOrder") - 1 AS expected_order,
        lag("minPoints") OVER (ORDER BY "displayOrder") AS previous_points
      FROM "RankConfig"
    ) ranked
    WHERE "displayOrder" <> expected_order OR
      "name"::text <> (enum_range(NULL::"RankName"))["displayOrder" + 1]::text OR
      ("displayOrder" = 0 AND "minPoints" <> 0) OR
      (previous_points IS NOT NULL AND "minPoints" <= previous_points)
  ) INTO invalid;
  IF invalid THEN
    RAISE EXCEPTION 'Unvon tartibi yoki ball chegarasi noto‘g‘ri' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "RankConfig_validate" AFTER INSERT OR UPDATE OR DELETE ON "RankConfig"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_rank_configuration"();

CREATE FUNCTION "rerank_users"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "User" u SET "rankName" = r."name", "updatedAt" = CURRENT_TIMESTAMP
    FROM LATERAL (SELECT "name", "minPoints" FROM "RankConfig") r
    WHERE r."minPoints" = (SELECT max("minPoints") FROM "RankConfig" WHERE "minPoints" <= u."points")
      AND u."rankName" IS DISTINCT FROM r."name";
  RETURN NULL;
END;
$$;
CREATE TRIGGER "RankConfig_rerank" AFTER UPDATE ON "RankConfig"
  FOR EACH STATEMENT EXECUTE FUNCTION "rerank_users"();
