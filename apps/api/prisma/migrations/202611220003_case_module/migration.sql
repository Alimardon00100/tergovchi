-- CreateEnum
CREATE TYPE "CaseFileStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_INVESTIGATION', 'QUALIFICATION_SUBMITTED', 'SCORED', 'CLOSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CasePersonRole" AS ENUM ('SUSPECT', 'WITNESS', 'VICTIM', 'OTHER');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SCORED');

-- CreateEnum
CREATE TYPE "QualificationElement" AS ENUM ('SUBJECT', 'PARTICIPATION', 'OBJECT', 'OBJECTIVE', 'SUBJECTIVE');

-- CreateEnum
CREATE TYPE "CaseDocumentType" AS ENUM ('EXPERT_REPORT', 'WITNESS_TESTIMONY', 'SUSPECT_TESTIMONY', 'PROTOCOL', 'DECISION', 'EVIDENCE_PHOTO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'HEAD';
ALTER TYPE "UserRole" ADD VALUE 'PROSECUTOR';
ALTER TYPE "UserRole" ADD VALUE 'AUDITOR';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ip" VARCHAR(45);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "departmentId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseFile" (
    "id" UUID NOT NULL,
    "caseNumber" VARCHAR(30) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "initialFacts" TEXT NOT NULL,
    "status" "CaseFileStatus" NOT NULL DEFAULT 'NEW',
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "assignedTergovchiId" UUID,
    "departmentId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "jkArticles" TEXT[],
    "referenceRevision" INTEGER NOT NULL DEFAULT 0,
    "suspendedFrom" "CaseFileStatus",
    "suspendedReason" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "jkArticle" VARCHAR(20) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "dateTime" TIMESTAMPTZ(3) NOT NULL,
    "weight" DECIMAL(8,3) NOT NULL DEFAULT 1,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "fullName" VARCHAR(160) NOT NULL,
    "birthDate" DATE NOT NULL,
    "gender" VARCHAR(10) NOT NULL,
    "addressEncrypted" TEXT NOT NULL,
    "pinflEncrypted" TEXT,
    "pinflLast4" CHAR(4),
    "photoUrl" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasePerson" (
    "caseId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "role" "CasePersonRole" NOT NULL,

    CONSTRAINT "CasePerson_pkey" PRIMARY KEY ("caseId","personId")
);

-- CreateTable
CREATE TABLE "CaseDocument" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "CaseDocumentType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "storageKey" VARCHAR(180) NOT NULL,
    "mime" VARCHAR(80) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "authorId" UUID NOT NULL,
    "isEvidence" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "status" "QualificationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualificationAnswer" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "qualificationId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "elementType" "QualificationElement" NOT NULL,
    "payload" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QualificationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceAnswer" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "elementType" "QualificationElement" NOT NULL,
    "payload" JSONB NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReferenceAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseScore" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "qualificationId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "totalScore" DECIMAL(5,2) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "referenceRevision" INTEGER NOT NULL,
    "referenceSnapshot" JSONB NOT NULL,
    "scoredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseLock" (
    "caseId" UUID NOT NULL,
    "lockedBy" UUID NOT NULL,
    "lockedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CaseLock_pkey" PRIMARY KEY ("caseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CaseFile_caseNumber_key" ON "CaseFile"("caseNumber");

-- CreateIndex
CREATE INDEX "CaseFile_status_deadlineAt_id_idx" ON "CaseFile"("status", "deadlineAt", "id");

-- CreateIndex
CREATE INDEX "CaseFile_departmentId_status_id_idx" ON "CaseFile"("departmentId", "status", "id");

-- CreateIndex
CREATE INDEX "CaseFile_assignedTergovchiId_status_id_idx" ON "CaseFile"("assignedTergovchiId", "status", "id");

-- CreateIndex
CREATE INDEX "CaseFile_jkArticles_idx" ON "CaseFile" USING GIN ("jkArticles");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_caseId_id_key" ON "Episode"("caseId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_caseId_episodeNumber_key" ON "Episode"("caseId", "episodeNumber");

-- CreateIndex
CREATE INDEX "CasePerson_personId_idx" ON "CasePerson"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseDocument_storageKey_key" ON "CaseDocument"("storageKey");

-- CreateIndex
CREATE INDEX "CaseDocument_caseId_type_createdAt_id_idx" ON "CaseDocument"("caseId", "type", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Qualification_caseId_createdBy_status_idx" ON "Qualification"("caseId", "createdBy", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Qualification_caseId_id_key" ON "Qualification"("caseId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QualificationAnswer_qualificationId_episodeId_elementType_key" ON "QualificationAnswer"("qualificationId", "episodeId", "elementType");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceAnswer_caseId_episodeId_elementType_key" ON "ReferenceAnswer"("caseId", "episodeId", "elementType");

-- CreateIndex
CREATE UNIQUE INDEX "CaseScore_qualificationId_key" ON "CaseScore"("qualificationId");

-- CreateIndex
CREATE INDEX "CaseScore_caseId_totalScore_attemptNumber_idx" ON "CaseScore"("caseId", "totalScore" DESC, "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CaseScore_caseId_attemptNumber_key" ON "CaseScore"("caseId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CaseScore_caseId_qualificationId_key" ON "CaseScore"("caseId", "qualificationId");

-- CreateIndex
CREATE INDEX "CaseLock_expiresAt_idx" ON "CaseLock"("expiresAt");

INSERT INTO "Department" ("id","code","name") VALUES ('00000000-0000-4000-8000-000000000001','ACADEMY','Oquv tergov bolinmasi'),('00000000-0000-4000-8000-000000000002','DISTRICT2','Ikkinchi bolinma');

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_assignedTergovchiId_fkey" FOREIGN KEY ("assignedTergovchiId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePerson" ADD CONSTRAINT "CasePerson_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePerson" ADD CONSTRAINT "CasePerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationAnswer" ADD CONSTRAINT "QualificationAnswer_caseId_qualificationId_fkey" FOREIGN KEY ("caseId", "qualificationId") REFERENCES "Qualification"("caseId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationAnswer" ADD CONSTRAINT "QualificationAnswer_caseId_episodeId_fkey" FOREIGN KEY ("caseId", "episodeId") REFERENCES "Episode"("caseId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceAnswer" ADD CONSTRAINT "ReferenceAnswer_caseId_episodeId_fkey" FOREIGN KEY ("caseId", "episodeId") REFERENCES "Episode"("caseId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseScore" ADD CONSTRAINT "CaseScore_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseScore" ADD CONSTRAINT "CaseScore_caseId_qualificationId_fkey" FOREIGN KEY ("caseId", "qualificationId") REFERENCES "Qualification"("caseId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseLock" ADD CONSTRAINT "CaseLock_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseLock" ADD CONSTRAINT "CaseLock_lockedBy_fkey" FOREIGN KEY ("lockedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_dates" CHECK ("deadlineAt">"openedAt"), ADD CONSTRAINT "CaseFile_closed" CHECK ((status='CLOSED')=("closedAt" IS NOT NULL)), ADD CONSTRAINT "CaseFile_assigned" CHECK (status NOT IN ('ASSIGNED','IN_INVESTIGATION','QUALIFICATION_SUBMITTED','SCORED','CLOSED') OR "assignedTergovchiId" IS NOT NULL), ADD CONSTRAINT "CaseFile_revision" CHECK ("referenceRevision">=0);
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_values" CHECK ("episodeNumber">0 AND weight>0);
ALTER TABLE "CaseScore" ADD CONSTRAINT "CaseScore_values" CHECK ("totalScore">=0 AND "totalScore"<=100 AND "attemptNumber" BETWEEN 1 AND 3);
ALTER TABLE "QualificationAnswer" ADD CONSTRAINT "Answer_version" CHECK (version>=1);
ALTER TABLE "CaseLock" ADD CONSTRAINT "CaseLock_dates" CHECK ("expiresAt">"lockedAt");
ALTER TABLE "ReferenceAnswer" ADD CONSTRAINT "Reference_weights" CHECK (weight=CASE WHEN "elementType"='SUBJECT' THEN 50 ELSE 12.5 END);
CREATE UNIQUE INDEX "Qualification_one_draft_per_author" ON "Qualification" ("caseId","createdBy") WHERE status='DRAFT';
