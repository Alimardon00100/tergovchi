import { z } from 'zod';
import { passwordSchema, publicUserSchema } from './contracts';
import { pointsSchema, rankConfigSchema } from './ranks';
import { caseViewSchema } from './workspace';

export const passwordChangeSchema = z
  .object({
    oldPassword: z.string().min(1, 'Amaldagi parolni kiriting.').max(128),
    newPassword: passwordSchema.refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      'Yangi parol UTF-8 formatida 72 baytdan oshmasin.',
    ),
  })
  .strict()
  .refine((value) => value.oldPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'Yangi parol amaldagi paroldan farq qilsin.',
  });
export const passwordChangedSchema = z.object({ changed: z.literal(true) }).strict();
export const safeProfileSchema = publicUserSchema.extend({
  rank: rankConfigSchema,
  progress: z
    .object({
      next: rankConfigSchema.nullable(),
      remaining: pointsSchema,
      percent: z.number().min(0).max(100),
    })
    .strict(),
});
export const safeCaseSchema = caseViewSchema.pick({
  id: true,
  title: true,
  slug: true,
  coverImageUrl: true,
  createdAt: true,
  difficulty: true,
  progress: true,
});
export const safeCasesSchema = z
  .object({ opened: z.array(safeCaseSchema), unopened: z.array(safeCaseSchema) })
  .strict();
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type SafeProfile = z.infer<typeof safeProfileSchema>;
export type SafeCase = z.infer<typeof safeCaseSchema>;
