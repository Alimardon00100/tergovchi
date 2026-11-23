import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import pino from 'pino';
import { SEED_CASES, rankConfigurationSchema } from '@detective/shared';
import { z } from 'zod';

const environmentSchema = z.object({ REDIS_URL: z.string().url() });
const prisma = new PrismaClient();
const logger = pino();

async function verify() {
  const environment = environmentSchema.parse(process.env);
  const redis = createClient({
    url: environment.REDIS_URL,
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  });
  redis.on('error', () => {
    logger.error({ event: 'redis.connection.failed' }, 'Redis ulanishida xato.');
  });
  try {
    await prisma.$queryRaw`SELECT 1`;
    rankConfigurationSchema.parse(
      await prisma.rankConfig.findMany({
        select: { name: true, title: true, minPoints: true, displayOrder: true },
      }),
    );
    const cases = await prisma.case.count({
      where: { slug: { in: SEED_CASES.map((entry) => entry.slug) } },
    });
    const admins = await prisma.user.count({ where: { role: 'ADMIN', bannedAt: null } });
    if (cases !== SEED_CASES.length || admins < 1)
      throw new Error('Seed ma’lumotlari yetarli emas.');
    await redis.connect();
    if ((await redis.ping()) !== 'PONG') throw new Error('Redis javobi noto‘g‘ri.');
    logger.info({ db: 'ok', redis: 'ok', cases, admins }, 'Poydevor tekshiruvi muvaffaqiyatli.');
  } finally {
    if (redis.isOpen) await redis.quit();
    await prisma.$disconnect();
  }
}

verify().catch((error: unknown) => {
  logger.error(
    {
      event: 'infra.verify.failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    },
    'Poydevor tekshiruvi bajarilmadi.',
  );
  process.exitCode = 1;
});
