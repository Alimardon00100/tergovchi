import { avatarUrlSchema } from './media';
import { z } from 'zod';
import { pointsSchema, rankNameSchema } from './ranks';

export const uuidSchema = z.string().uuid('Identifikator noto‘g‘ri.');
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Elektron pochta noto‘g‘ri.')
  .max(254);
export const passwordSchema = z
  .string()
  .min(12, 'Parol kamida 12 belgidan iborat bo‘lsin.')
  .max(128);
export const roleSchema = z.enum(['USER', 'HEAD', 'PROSECUTOR', 'ADMIN', 'AUDITOR']);
export const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export const casePublicationSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const progressStatusSchema = z.enum(['IN_PROGRESS', 'CLOSED']);
export const evidenceTypeSchema = z.enum(['TEXT', 'IMAGE', 'DOCUMENT']);
export const transactionTypeSchema = z.enum(['CASE_OPEN', 'ADMIN_ADJUSTMENT']);

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z.string().trim().min(2).max(80),
  })
  .strict();
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();

// DECISION: javob sxemasi ruxsat etilgan maydonlarni sanaydi; parol va token digestlari kirmaydi.
export const publicUserSchema = z
  .object({
    id: uuidSchema,
    email: emailSchema,
    displayName: z.string().min(2).max(80),
    role: roleSchema,
    points: pointsSchema,
    rankName: rankNameSchema,
    avatarUrl: avatarUrlSchema,
    createdAt: z.string().datetime(),
  })
  .strict();

export const caseWriteSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(10).max(2000),
    description: z.string().trim().min(20).max(20000),
    difficulty: difficultySchema,
    customPoints: pointsSchema.nullable().default(null),
    publication: casePublicationSchema.default('DRAFT'),
    coverAssetKey: z
      .string()
      .max(512)
      .regex(/^cases\/[a-zA-Z0-9/_-]+\.(?:webp|jpg|png)$/)
      .nullable()
      .default(null),
  })
  .strict();

export const evidenceSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('TEXT'),
      title: z.string().min(1).max(160),
      content: z.string().min(1).max(20000),
    })
    .strict(),
  z
    .object({
      type: z.literal('IMAGE'),
      title: z.string().min(1).max(160),
      assetKey: z.string().regex(/^evidence\/[a-zA-Z0-9/_-]+\.webp$/),
    })
    .strict(),
  z
    .object({
      type: z.literal('DOCUMENT'),
      title: z.string().min(1).max(160),
      assetKey: z.string().regex(/^evidence\/[a-zA-Z0-9/_-]+\.pdf$/),
    })
    .strict(),
]);

export const caseSummarySchema = caseWriteSchema.extend({
  id: uuidSchema,
  basePoints: z.union([z.literal(20), z.literal(30), z.literal(50)]),
  createdAt: z.string().datetime(),
});
export const caseProgressSchema = z
  .object({
    caseId: uuidSchema,
    status: progressStatusSchema,
    awardedPoints: pointsSchema,
    openedAt: z.string().datetime(),
    closedAt: z.string().datetime().nullable(),
  })
  .strict()
  .superRefine((progress, ctx) => {
    if ((progress.status === 'CLOSED') !== (progress.closedAt !== null)) {
      ctx.addIssue({ code: 'custom', message: 'Ish holati va yopilish vaqti mos emas.' });
    }
    if (progress.closedAt && Date.parse(progress.closedAt) < Date.parse(progress.openedAt)) {
      ctx.addIssue({ code: 'custom', message: 'Yopilish vaqti ochilishdan oldin bo‘la olmaydi.' });
    }
  });
export const idempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const pointAdjustmentSchema = z
  .object({
    amount: z
      .number()
      .int()
      .min(-2_147_483_647)
      .max(2_147_483_647)
      .refine((amount) => amount !== 0),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export const userStatisticsSchema = z
  .object({
    opened: pointsSchema,
    inProgress: pointsSchema,
    closed: pointsSchema,
    unopened: pointsSchema,
    totalPoints: pointsSchema,
  })
  .strict();
export const leaderboardEntrySchema = publicUserSchema.pick({
  id: true,
  displayName: true,
  avatarUrl: true,
  points: true,
  rankName: true,
});
export const auditLogSchema = z
  .object({
    id: uuidSchema,
    actorId: uuidSchema.nullable(),
    action: z.string().min(1).max(80),
    targetType: z.string().min(1).max(80),
    targetId: z.string().max(128).nullable(),
    requestId: uuidSchema,
    createdAt: z.string().datetime(),
  })
  .strict();

export function successEnvelope<T extends z.ZodType>(dataSchema: T) {
  return z.object({ success: z.literal(true), data: dataSchema, requestId: uuidSchema }).strict();
}
export const errorEnvelopeSchema = z
  .object({
    success: z.literal(false),
    error: z.object({ code: z.string().max(80), message: z.string().max(500) }).strict(),
    requestId: uuidSchema,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type CaseWriteInput = z.infer<typeof caseWriteSchema>;
export type CaseSummary = z.infer<typeof caseSummarySchema>;
export type CaseProgress = z.infer<typeof caseProgressSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
