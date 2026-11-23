import { z } from 'zod';
import { uuidSchema, roleSchema, publicUserSchema } from '../contracts';
export const CASE_STATUSES = [
  'NEW',
  'ASSIGNED',
  'IN_INVESTIGATION',
  'QUALIFICATION_SUBMITTED',
  'SCORED',
  'CLOSED',
  'SUSPENDED',
] as const;
export const caseStatusSchema = z.enum(CASE_STATUSES);
export const CASE_DOCUMENT_TYPES = [
  'EXPERT_REPORT',
  'WITNESS_TESTIMONY',
  'SUSPECT_TESTIMONY',
  'PROTOCOL',
  'DECISION',
  'EVIDENCE_PHOTO',
] as const;
export const documentTypeSchema = z.enum(CASE_DOCUMENT_TYPES);
export const casePersonRoleSchema = z.enum(['SUSPECT', 'WITNESS', 'VICTIM', 'OTHER']);
export const articleSchema = z
  .string()
  .regex(/^\d{1,3}(?:-\d{1,2})?$/, 'JK modda raqamini kiriting.');
const actorSummary = z.object({ id: uuidSchema, displayName: z.string() }).strict();
export const departmentSchema = z
  .object({ id: uuidSchema, name: z.string(), code: z.string() })
  .strict();
export const casePreviewSchema = z
  .object({
    id: uuidSchema,
    caseNumber: z.string(),
    title: z.string(),
    summary: z.string(),
    initialFacts: z.string(),
    status: caseStatusSchema,
    openedAt: z.string().datetime(),
    deadlineAt: z.string().datetime(),
    closedAt: z.string().datetime().nullable(),
    jkArticles: z.array(articleSchema),
    episodeCount: z.number().int(),
    assignee: actorSummary.nullable(),
    department: departmentSchema,
    lock: z
      .object({
        lockedBy: uuidSchema,
        lockedAt: z.string().datetime(),
        expiresAt: z.string().datetime(),
      })
      .nullable(),
    canTake: z.boolean(),
    canEnter: z.boolean(),
    blockReason: z.string().nullable(),
  })
  .strict();
export const episodeSchema = z
  .object({
    id: uuidSchema,
    episodeNumber: z.number().int().positive(),
    description: z.string(),
    jkArticle: articleSchema,
    location: z.string(),
    dateTime: z.string().datetime(),
    weight: z.number().positive(),
  })
  .strict();
export const caseListQuerySchema = z
  .object({
    status: caseStatusSchema.optional(),
    jkArticle: articleSchema.optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    investigatorId: uuidSchema.optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(6),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'Sana oralig‘i noto‘g‘ri.');
export const caseListSchema = z
  .object({
    items: z.array(casePreviewSchema),
    total: z.number().int().min(0),
    page: z.number().int(),
    pageSize: z.number().int(),
    serverTime: z.string().datetime(),
  })
  .strict();
export const caseMetaSchema = z
  .object({
    user: publicUserSchema,
    department: departmentSchema,
    departments: z.array(departmentSchema),
    investigators: z.array(actorSummary),
  })
  .strict();
export const caseWorkspaceSchema = z
  .object({
    case: casePreviewSchema,
    episodes: z.array(episodeSchema),
    permissions: z
      .object({
        canEdit: z.boolean(),
        canApprove: z.boolean(),
        canReassign: z.boolean(),
        canManage: z.boolean(),
      })
      .strict(),
    attemptsUsed: z.number().int().min(0).max(3),
    referenceReady: z.boolean(),
    serverTime: z.string().datetime(),
  })
  .strict();
const episodeInput = z
  .object({
    episodeNumber: z.number().int().min(1).max(100),
    description: z.string().trim().min(10).max(8000),
    jkArticle: articleSchema,
    location: z.string().trim().min(2).max(200),
    dateTime: z.string().datetime(),
    weight: z.number().positive().max(100).default(1),
  })
  .strict();
export const caseFileCreateSchema = z
  .object({
    caseNumber: z.string().regex(/^\d{1,3}-\d{4}-\d{3,8}$/),
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(20).max(2000),
    initialFacts: z.string().trim().min(20).max(8000),
    openedAt: z.string().datetime(),
    deadlineAt: z.string().datetime(),
    departmentId: uuidSchema,
    jkArticles: z.array(articleSchema).min(1).max(8),
    episodes: z.array(episodeInput).min(1).max(10),
  })
  .strict()
  .refine(
    (v) => Date.parse(v.deadlineAt) > Date.parse(v.openedAt),
    'Muddat ish ochilgan vaqtdan keyin bo‘lsin.',
  )
  .refine(
    (v) => new Set(v.episodes.map((e) => e.episodeNumber)).size === v.episodes.length,
    'Epizod raqamlari takrorlanmasin.',
  );
export const personCreateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160),
    birthDate: z.string().date(),
    gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']),
    address: z.string().trim().min(5).max(500),
    pinfl: z
      .string()
      .regex(/^\d{14}$/)
      .nullable()
      .default(null),
    photoUrl: z
      .string()
      .regex(/^\/suspects\/(?:letter|station|museum|phone|room|thread)\.webp$/)
      .nullable()
      .default(null),
    role: casePersonRoleSchema,
  })
  .strict();
export const personViewSchema = z
  .object({
    id: uuidSchema,
    fullName: z.string(),
    birthDate: z.string().date(),
    gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']),
    address: z.string(),
    pinfl: z.string().nullable(),
    photoUrl: z.string().nullable(),
    role: casePersonRoleSchema,
    masked: z.boolean(),
  })
  .strict();
export const personsSchema = z.array(personViewSchema);
export const documentCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    type: documentTypeSchema,
    isEvidence: z.boolean(),
  })
  .strict();
export const documentViewSchema = z
  .object({
    id: uuidSchema,
    title: z.string(),
    type: documentTypeSchema,
    mime: z.string(),
    bytes: z.number().int().positive(),
    isEvidence: z.boolean(),
    createdAt: z.string().datetime(),
    signedUrl: z.string().startsWith('/api/v1/cases/'),
    expiresAt: z.string().datetime(),
  })
  .strict();
export const documentsSchema = z.array(documentViewSchema);
export const reassignSchema = z
  .object({ userId: uuidSchema, reason: z.string().trim().min(5).max(1000) })
  .strict();
export const resumeSchema = z
  .object({ deadlineAt: z.string().datetime(), reason: z.string().trim().min(5).max(1000) })
  .strict();
export const userRoleUpdateSchema = z
  .object({ role: roleSchema, departmentId: uuidSchema, banned: z.boolean() })
  .strict();
export const legalUserSchema = publicUserSchema.extend({
  departmentId: uuidSchema,
  bannedAt: z.string().datetime().nullable(),
});
export const adminUsersSchema = z
  .object({ items: z.array(legalUserSchema), total: z.number().int() })
  .strict();
export const auditViewSchema = z
  .object({
    id: uuidSchema,
    actorId: uuidSchema.nullable(),
    action: z.string(),
    targetType: z.string(),
    targetId: z.string().nullable(),
    requestId: uuidSchema,
    ip: z.string().nullable(),
    createdAt: z.string().datetime(),
    metadata: z.unknown(),
  })
  .strict();
export const auditListSchema = z
  .object({ items: z.array(auditViewSchema), total: z.number().int() })
  .strict();
export type CasePreview = z.infer<typeof casePreviewSchema>;
export type CaseWorkspace = z.infer<typeof caseWorkspaceSchema>;
export type CaseMeta = z.infer<typeof caseMetaSchema>;
export type CasePersonView = z.infer<typeof personViewSchema>;
export type CaseFileCreate = z.infer<typeof caseFileCreateSchema>;
export type PersonCreate = z.infer<typeof personCreateSchema>;
export type CaseListQuery = z.infer<typeof caseListQuerySchema>;
