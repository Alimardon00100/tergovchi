import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const logger = pino();

async function main() {
  const rawUrl = process.env['TEST_DATABASE_URL'];
  if (!rawUrl) throw new Error('TEST_DATABASE_URL belgilanmagan.');
  const url = new URL(rawUrl);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname)
  ) {
    throw new Error('Test bazasi nomi _test bilan tugashi shart.');
  }
  // DECISION: har bir sinov alohida sxemada ishlaydi; asosiy baza manzili qabul qilinmaydi.
  const schema = `phase0_${randomUUID().replaceAll('-', '')}`;
  url.searchParams.set('schema', schema);
  const env = { ...process.env, DATABASE_URL: url.toString(), TEST_DATABASE_URL: url.toString() };
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    const migration = spawnSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      { env, stdio: 'inherit' },
    );
    if (migration.error || migration.status !== 0)
      throw new Error('Test migratsiyasi bajarilmadi.');
    const tests = spawnSync(
      process.execPath,
      [
        join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'),
        'run',
        process.argv.includes('--case-opening-character')
          ? 'tests/character/case-opening.integration.test.ts'
          : process.argv.includes('--case-module')
            ? 'tests/case-module.integration.test.ts'
            : process.argv.includes('--http')
              ? 'tests/http.integration.test.ts'
              : 'tests/database.integration.test.ts',
        '--testTimeout=20000',
        '--hookTimeout=30000',
      ],
      { env, stdio: 'inherit' },
    );
    if (tests.error || tests.status !== 0) process.exitCode = 1;
  } finally {
    // Identifikator faqat randomUUID dan tuzilgan; foydalanuvchi matni SQLga kirmaydi.
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  logger.error(
    {
      event: 'database.tests.failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    },
    'Test bazasini va TEST_DATABASE_URL ni tekshiring.',
  );
  process.exitCode = 1;
});
