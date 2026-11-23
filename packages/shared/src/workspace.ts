import { localMediaUrlSchema } from './media';
import { z } from 'zod';
import {
  publicUserSchema,
  caseSummarySchema,
  caseProgressSchema,
  leaderboardEntrySchema,
} from './contracts';
import { rankConfigSchema } from './ranks';

export const evidenceViewSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: z.enum(['TEXT', 'IMAGE', 'DOCUMENT']),
  content: z.string().nullable(),
  assetKey: z.string().nullable(),
});
export const caseViewSchema = caseSummarySchema.extend({
  coverImageUrl: localMediaUrlSchema.nullable(),
  evidence: z.array(evidenceViewSchema),
  progress: caseProgressSchema.nullable(),
});
export const activitySchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  title: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export const workspaceSchema = z.object({
  user: publicUserSchema,
  ranks: z.array(rankConfigSchema),
  cases: z.array(caseViewSchema),
  activity: z.array(activitySchema),
  leaderboard: z.array(leaderboardEntrySchema),
  weekly: z.array(
    z.object({ day: z.string(), points: z.number().int(), opened: z.number().int() }),
  ),
});
export const profileUpdateSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Kamida 2 belgi kiriting.')
      .max(80, 'Ko‘pi bilan 80 belgi kiriting.'),
  })
  .strict();
export const caseActionResultSchema = z.object({
  awarded: z.boolean(),
  pointsAdded: z.number().int(),
  rankChanged: z.boolean(),
});
export type CaseView = z.infer<typeof caseViewSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type Activity = z.infer<typeof activitySchema>;
