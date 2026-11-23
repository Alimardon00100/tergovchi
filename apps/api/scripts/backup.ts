import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createCaseBackup } from '../src/case-module/backup.service';
const db = new PrismaClient();
async function main() {
  const local = resolve(process.env['RUNTIME_ROOT'] ?? process.cwd(), '.local');
  const secret =
    process.env['JWT_SECRET'] ?? (await readFile(join(local, 'http-secret'), 'utf8')).trim();
  const result = await createCaseBackup(db, local, secret);
  process.stdout.write(JSON.stringify({ event: 'backup.completed', ...result }) + '\n');
}
main()
  .catch(() => {
    process.stderr.write('Backup bajarilmadi. Baza ulanishi va diskni tekshiring.\n');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
