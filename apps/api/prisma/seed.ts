import { seedLocalLegal } from '../src/case-module/seed';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { seedEnvironmentSchema } from '../src/infra/seed-config';
import { seedDatabase } from '../src/infra/seed';

const logger = pino({
  redact: ['password', 'passwordHash', 'DATABASE_URL', 'SEED_ADMIN_PASSWORD'],
});
const prisma = new PrismaClient();

async function main() {
  const environment = seedEnvironmentSchema.parse(process.env);
  const result = await seedDatabase(prisma, environment);
  const legal = await seedLocalLegal(prisma);
  logger.info(
    { ...result, ...legal, event: 'seed.completed' },
    'Boshlang‘ich ma’lumotlar tekshirildi.',
  );
}

main()
  .catch((error: unknown) => {
    // DECISION: Prisma xatolaridagi ulanish ma’lumotlari logga chiqarilmaydi.
    logger.error(
      { event: 'seed.failed', errorType: error instanceof Error ? error.name : 'UnknownError' },
      'Seed bajarilmadi. Muhit va migratsiya holatini tekshiring.',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
