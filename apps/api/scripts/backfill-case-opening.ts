import { PrismaClient } from '@prisma/client';
import { backfillCaseOpening } from '../src/case-module/backfill';

const db = new PrismaClient();
backfillCaseOpening(db)
  .then((result) => process.stdout.write(JSON.stringify(result) + '\n'))
  .catch(() => {
    process.stderr.write('Case opening backfill failed. Check database access.\n');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
