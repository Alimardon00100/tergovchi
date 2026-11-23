import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const adminPassword = randomBytes(24).toString('base64url');
const values = [
  'LOCAL_SERVICES=managed',
  'DATABASE_URL=postgresql://detective:CHANGE_ME@127.0.0.1:15432/detective?schema=public',
  'TEST_DATABASE_URL=postgresql://detective:CHANGE_ME@127.0.0.1:15432/detective_test?schema=public',
  'REDIS_URL=redis://127.0.0.1:16379',
  'SEED_ADMIN_EMAIL=admin@example.test',
  'SEED_ADMIN_NAME="Bosh tergovchi"',
  `SEED_ADMIN_PASSWORD=${adminPassword}`,
  '',
].join('\n');

try {
  await writeFile(new URL('../.env', import.meta.url), values, { flag: 'wx', mode: 0o600 });
  process.stdout.write(
    `Muhit yaratildi: ${projectRoot}.env. Admin paroli faqat shu faylda saqlanadi.\n`,
  );
  process.stdout.write('Mahalliy ulanishlar run.bat tomonidan avtomatik sozlanadi.\n');
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
    process.stderr.write('.env allaqachon mavjud; qiymatlar o‘zgartirilmadi.\n');
  } else {
    process.stderr.write('Muhit faylini yaratib bo‘lmadi. Yozish huquqini tekshiring.\n');
    process.exitCode = 1;
  }
}
