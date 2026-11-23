-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RankName" AS ENUM ('LIEUTENANT', 'SENIOR_LIEUTENANT', 'CAPTAIN', 'MAJOR', 'LIEUTENANT_COLONEL', 'COLONEL', 'MAJOR_GENERAL', 'LIEUTENANT_GENERAL', 'COLONEL_GENERAL', 'MARSHAL');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "CasePublication" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "PointTransactionType" AS ENUM ('CASE_OPEN', 'ADMIN_ADJUSTMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "points" INTEGER NOT NULL DEFAULT 0,
    "rankName" "RankName" NOT NULL DEFAULT 'LIEUTENANT',
    "avatarKey" VARCHAR(512),
    "bannedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankConfig" (
    "name" "RankName" NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "minPoints" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RankConfig_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "basePoints" INTEGER NOT NULL,
    "customPoints" INTEGER,
    "publication" "CasePublication" NOT NULL DEFAULT 'DRAFT',
    "coverAssetKey" VARCHAR(512),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvidence" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "content" TEXT,
    "assetKey" VARCHAR(512),
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "CaseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCaseProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "awardedPoints" INTEGER NOT NULL,
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "UserCaseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "caseId" UUID,
    "type" "PointTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "requestId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "targetType" VARCHAR(80) NOT NULL,
    "targetId" VARCHAR(128),
    "requestId" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_points_createdAt_id_idx" ON "User"("points" DESC, "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RankConfig_minPoints_key" ON "RankConfig"("minPoints");

-- CreateIndex
CREATE UNIQUE INDEX "RankConfig_displayOrder_key" ON "RankConfig"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Case_slug_key" ON "Case"("slug");

-- CreateIndex
CREATE INDEX "Case_publication_createdAt_id_idx" ON "Case"("publication", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Case_publication_difficulty_createdAt_id_idx" ON "Case"("publication", "difficulty", "createdAt" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "CaseEvidence_caseId_displayOrder_key" ON "CaseEvidence"("caseId", "displayOrder");

-- CreateIndex
CREATE INDEX "UserCaseProgress_userId_status_openedAt_id_idx" ON "UserCaseProgress"("userId", "status", "openedAt" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "UserCaseProgress_userId_caseId_key" ON "UserCaseProgress"("userId", "caseId");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_createdAt_id_idx" ON "PointTransaction"("userId", "createdAt" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "PointTransaction_userId_idempotencyKey_key" ON "PointTransaction"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PointTransaction_userId_caseId_type_key" ON "PointTransaction"("userId", "caseId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_replacedById_key" ON "RefreshToken"("replacedById");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_revokedAt_idx" ON "RefreshToken"("familyId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_rankName_fkey" FOREIGN KEY ("rankName") REFERENCES "RankConfig"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCaseProgress" ADD CONSTRAINT "UserCaseProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCaseProgress" ADD CONSTRAINT "UserCaseProgress_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
