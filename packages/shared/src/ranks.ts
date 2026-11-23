import { z } from 'zod';

export const rankNameSchema = z.enum([
  'LIEUTENANT',
  'SENIOR_LIEUTENANT',
  'CAPTAIN',
  'MAJOR',
  'LIEUTENANT_COLONEL',
  'COLONEL',
  'MAJOR_GENERAL',
  'LIEUTENANT_GENERAL',
  'COLONEL_GENERAL',
  'MARSHAL',
]);

export const pointsSchema = z.number().int().min(0).max(2_147_483_647);
export const rankConfigSchema = z
  .object({
    name: rankNameSchema,
    title: z.string().trim().min(1).max(80),
    minPoints: pointsSchema,
    displayOrder: z.number().int().min(0).max(9),
  })
  .strict();

export type RankName = z.infer<typeof rankNameSchema>;
export type RankConfig = z.infer<typeof rankConfigSchema>;

export const DEFAULT_RANKS: readonly RankConfig[] = [
  { name: 'LIEUTENANT', title: 'Leytenant', minPoints: 0, displayOrder: 0 },
  { name: 'SENIOR_LIEUTENANT', title: 'Katta leytenant', minPoints: 150, displayOrder: 1 },
  { name: 'CAPTAIN', title: 'Kapitan', minPoints: 350, displayOrder: 2 },
  { name: 'MAJOR', title: 'Mayor', minPoints: 750, displayOrder: 3 },
  { name: 'LIEUTENANT_COLONEL', title: 'Podpolkovnik', minPoints: 1200, displayOrder: 4 },
  { name: 'COLONEL', title: 'Polkovnik', minPoints: 2000, displayOrder: 5 },
  { name: 'MAJOR_GENERAL', title: 'General-mayor', minPoints: 3000, displayOrder: 6 },
  { name: 'LIEUTENANT_GENERAL', title: 'General-leytenant', minPoints: 4500, displayOrder: 7 },
  { name: 'COLONEL_GENERAL', title: 'General-polkovnik', minPoints: 6500, displayOrder: 8 },
  { name: 'MARSHAL', title: 'Marshal', minPoints: 12000, displayOrder: 9 },
];

// DECISION: konfiguratsiya tartibi tekshiriladi; tashqi massiv tartibiga ishonilmaydi.
export const rankConfigurationSchema = z
  .array(rankConfigSchema)
  .length(10)
  .superRefine((ranks, ctx) => {
    const ordered = [...ranks].sort((a, b) => a.displayOrder - b.displayOrder);
    if (new Set(ordered.map((rank) => rank.name)).size !== rankNameSchema.options.length) {
      ctx.addIssue({ code: 'custom', message: 'Har bir unvon bir marta berilishi kerak.' });
    }
    ordered.forEach((rank, index) => {
      const previous = ordered[index - 1];
      if (
        rank.displayOrder !== index ||
        rank.name !== rankNameSchema.options[index] ||
        (index === 0 && rank.minPoints !== 0) ||
        (previous !== undefined && rank.minPoints <= previous.minPoints)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Unvonlar tartibi yoki ball chegarasi noto‘g‘ri.',
        });
      }
    });
  });

export function resolveRank(
  points: number,
  configuration: readonly RankConfig[] = DEFAULT_RANKS,
): RankConfig {
  pointsSchema.parse(points);
  const ranks = rankConfigurationSchema
    .parse(configuration)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const rank = ranks.findLast((candidate) => points >= candidate.minPoints);
  if (!rank) throw new Error('Boshlang‘ich unvon topilmadi.');
  return rank;
}

export function getRankProgress(
  points: number,
  configuration: readonly RankConfig[] = DEFAULT_RANKS,
) {
  const current = resolveRank(points, configuration);
  const next = configuration.find((rank) => rank.displayOrder === current.displayOrder + 1) ?? null;
  return {
    current,
    next,
    remaining: next ? next.minPoints - points : 0,
    percent: next
      ? ((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100
      : 100,
  };
}
