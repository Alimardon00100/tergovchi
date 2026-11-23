import { hash, argon2id } from 'argon2';
import { Prisma, type PrismaClient } from '@prisma/client';
import { DEFAULT_RANKS, SEED_CASES, caseWriteSchema, resolveCasePoints } from '@detective/shared';
import type { SeedEnvironment } from './seed-config';
import { SEED_EVIDENCE } from './seed-evidence';

// DECISION: seed mavjud adminni ko‘tarmaydi va mavjud ishlarni qayta yozmaydi (ADR-003).
export async function seedDatabase(prisma: PrismaClient, environment: SeedEnvironment) {
  const passwordHash = await hash(environment.SEED_ADMIN_PASSWORD, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72413001)`;
      for (const rank of DEFAULT_RANKS) {
        await tx.rankConfig.upsert({ where: { name: rank.name }, update: {}, create: rank });
      }
      const existing = await tx.user.findUnique({ where: { email: environment.SEED_ADMIN_EMAIL } });
      if (existing && (existing.role !== 'ADMIN' || existing.bannedAt !== null)) {
        throw new Error(
          'Seed manzilida faol admin bo‘lmagan hisob mavjud. Boshqa admin manzilini belgilang.',
        );
      }
      const admin =
        existing ??
        (await tx.user.create({
          data: {
            email: environment.SEED_ADMIN_EMAIL,
            displayName: environment.SEED_ADMIN_NAME,
            passwordHash,
            role: 'ADMIN',
          },
        }));
      for (const candidate of SEED_CASES) {
        const data = caseWriteSchema.parse(candidate);
        const entry = await tx.case.upsert({
          where: { slug: data.slug },
          update: {},
          create: { ...data, basePoints: resolveCasePoints(data.difficulty, null) },
        });
        const clues = SEED_EVIDENCE[data.slug];
        if (clues && (await tx.caseEvidence.count({ where: { caseId: entry.id } })) === 0) {
          await tx.caseEvidence.createMany({
            data: clues.map((clue, displayOrder) => ({
              ...clue,
              displayOrder,
              caseId: entry.id,
              type: 'TEXT' as const,
            })),
          });
        }
      }
      return {
        adminId: admin.id,
        ranks: await tx.rankConfig.count(),
        cases: await tx.case.count(),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 },
  );
}
