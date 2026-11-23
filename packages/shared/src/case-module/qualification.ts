import { z } from 'zod';
import { uuidSchema } from '../contracts';
export const LEGAL_ELEMENTS = [
  'SUBJECT',
  'PARTICIPATION',
  'OBJECT',
  'OBJECTIVE',
  'SUBJECTIVE',
] as const;
export const elementSchema = z.enum(LEGAL_ELEMENTS);
export type LegalElement = z.infer<typeof elementSchema>;
export const PARTICIPANT_ROLES = ['IJROCHI', 'TASHKILOTCHI', 'DALOLATCHI', 'YORDAMCHI'] as const;
export const participantRoleSchema = z.enum(PARTICIPANT_ROLES);
export const OBJECT_TYPES = [
  'PERSON_LIFE',
  'PROPERTY',
  'PUBLIC_SAFETY',
  'STATE_AUTHORITY',
  'PUBLIC_HEALTH',
  'OTHER',
] as const;
export const CONSEQUENCES = ['MATERIAL', 'PHYSICAL', 'MORAL', 'OTHER'] as const;
export const MOTIVES = ['GREED', 'REVENGE', 'JEALOUSY', 'NEGLIGENCE', 'OTHER'] as const;
export const PURPOSES = ['ENRICHMENT', 'CONCEALMENT', 'INTIMIDATION', 'HARM', 'OTHER'] as const;
export const ELEMENT_WEIGHTS = {
  SUBJECT: 50,
  PARTICIPATION: 12.5,
  OBJECT: 12.5,
  OBJECTIVE: 12.5,
  SUBJECTIVE: 12.5,
} as const;
const tuple = z.object({ personId: uuidSchema, role: participantRoleSchema }).strict();
const note = z.string().max(2000, 'Izoh 2000 belgidan oshmasin.');
export const draftSchemas = {
  SUBJECT: z.array(tuple).max(50),
  PARTICIPATION: z
    .array(
      z
        .object({
          personId: z.union([uuidSchema, z.literal('')]),
          role: z.union([participantRoleSchema, z.literal('')]),
        })
        .strict(),
    )
    .max(50),
  OBJECT: z.array(z.enum(OBJECT_TYPES)).max(OBJECT_TYPES.length),
  OBJECTIVE: z
    .object({
      action: z.enum(['', 'HARAKAT', 'HARAKATSIZLIK']),
      consequences: z.array(z.enum(CONSEQUENCES)).max(4),
      causality: z.enum(['', 'MAVJUD', 'YOQ']),
      note,
    })
    .strict(),
  SUBJECTIVE: z
    .object({
      guilt: z.enum(['', 'QASDDAN', 'EHTIYOTSIZLIKDAN']),
      intent: z.enum(['', 'TOGRI', 'EGRI']),
      motive: z.enum(['', ...MOTIVES]),
      motiveNote: note,
      purpose: z.enum(['', ...PURPOSES]),
      purposeNote: note,
    })
    .strict(),
};
export const completeSchemas = {
  SUBJECT: draftSchemas.SUBJECT.min(1, 'Kamida bitta subyekt tanlang.').refine(
    (rows) => new Set(rows.map((row) => row.personId)).size === rows.length,
    'Subyekt bir marta tanlanadi.',
  ),
  PARTICIPATION: z.array(tuple).max(50),
  OBJECT: draftSchemas.OBJECT.min(1, 'Kamida bitta obyekt tanlang.'),
  OBJECTIVE: draftSchemas.OBJECTIVE.refine(
    (value) => value.action !== '' && value.consequences.length > 0 && value.causality !== '',
    'Obyektiv tomonning barcha maydonlarini to‘ldiring.',
  ),
  SUBJECTIVE: draftSchemas.SUBJECTIVE.refine(
    (value) =>
      value.guilt !== '' &&
      value.motive !== '' &&
      value.purpose !== '' &&
      (value.guilt === 'QASDDAN' ? value.intent !== '' : value.intent === ''),
    'Subyektiv tomonning barcha maydonlarini to‘ldiring.',
  ),
};
export type PayloadMap = { [K in LegalElement]: z.infer<(typeof draftSchemas)[K]> };
export const emptyPayloads = (): PayloadMap => ({
  SUBJECT: [],
  PARTICIPATION: [],
  OBJECT: [],
  OBJECTIVE: { action: '', consequences: [], causality: '', note: '' },
  SUBJECTIVE: { guilt: '', intent: '', motive: '', motiveNote: '', purpose: '', purposeNote: '' },
});
export const draftWriteSchema = z
  .object({
    episodeId: uuidSchema,
    payload: z.unknown(),
    baseVersion: z.number().int().min(0).max(2147483646),
  })
  .strict();
export const referenceWriteSchema = z
  .object({
    revision: z.number().int().min(0),
    answers: z
      .array(
        z
          .object({ episodeId: uuidSchema, elementType: elementSchema, payload: z.unknown() })
          .strict(),
      )
      .min(5)
      .max(50),
  })
  .strict();
export const submitQualificationSchema = z.object({ qualificationId: uuidSchema }).strict();
export const answerViewSchema = z
  .object({
    episodeId: uuidSchema,
    elementType: elementSchema,
    payload: z.unknown(),
    version: z.number().int().min(1),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const draftViewSchema = z
  .object({
    id: uuidSchema.nullable(),
    answers: z.array(answerViewSchema),
    attemptsUsed: z.number().int().min(0).max(3),
    referenceReady: z.boolean(),
    canEdit: z.boolean(),
    serverTime: z.string().datetime(),
  })
  .strict();
export const draftSavedSchema = z
  .object({ qualificationId: uuidSchema, answer: answerViewSchema, conflict: z.boolean() })
  .strict();
export const elementScoreSchema = z
  .object({
    element: elementSchema,
    points: z.number().min(0).max(50),
    max: z.number().positive().max(50),
    f1: z.number().min(0).max(1),
    fields: z.array(z.object({ field: z.string(), f1: z.number().min(0).max(1) })),
  })
  .strict();
export const episodeScoreSchema = z
  .object({
    episodeId: uuidSchema,
    episodeNumber: z.number().int().positive(),
    weight: z.number().positive(),
    score: z.number().min(0).max(100),
    elements: z.array(elementScoreSchema).length(5),
  })
  .strict();
export const scoreBreakdownSchema = z
  .object({ episodes: z.array(episodeScoreSchema).min(1), total: z.number().min(0).max(100) })
  .strict();
export const scoreViewSchema = z
  .object({
    id: uuidSchema,
    qualificationId: uuidSchema,
    createdBy: uuidSchema,
    investigator: z.string(),
    attemptNumber: z.number().int().min(1).max(3),
    totalScore: z.number().min(0).max(100),
    referenceRevision: z.number().int().min(1),
    scoredAt: z.string().datetime(),
    breakdown: scoreBreakdownSchema,
  })
  .strict();
export const scoreHistorySchema = z
  .object({
    items: z.array(scoreViewSchema),
    best: z.number().min(0).max(100).nullable(),
    attemptsUsed: z.number().int().min(0).max(3),
    maxAttempts: z.literal(3),
  })
  .strict();
