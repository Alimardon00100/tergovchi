import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

async function main() {
  const raw = process.env['DATABASE_URL'];
  if (!raw) throw Error('DATABASE_URL belgilanmagan.');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.pathname.slice(1))
    throw Error('PostgreSQL URLni tekshiring.');
  let dump = process.env['PG_DUMP_PATH'] ?? 'pg_dump';
  const portable = resolve('.tools/postgres-client-16.16/bin/pg_dump.exe');
  if (!process.env['PG_DUMP_PATH'] && process.platform === 'win32' && existsSync(portable))
    dump = portable;
  else if (!process.env['PG_DUMP_PATH'] && process.platform === 'win32') {
    const require = createRequire(import.meta.url),
      sdkRequire = createRequire(require.resolve('embedded-postgres'));
    const binaries = await import(
      pathToFileURL(sdkRequire.resolve('@embedded-postgres/windows-x64')).href
    );
    const candidate = join(dirname(binaries.pg_ctl), 'pg_dump.exe');
    if (existsSync(candidate)) dump = candidate;
  }
  const restore =
    process.env['PG_RESTORE_PATH'] ??
    (dump.includes('/') || dump.includes('\\')
      ? join(dirname(dump), process.platform === 'win32' ? 'pg_restore.exe' : 'pg_restore')
      : 'pg_restore');
  const directory = resolve('.local/backups');
  await mkdir(directory, { recursive: true });
  const filename = `case-opening-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.dump`,
    path = join(directory, filename);
  await writeFile(path, '', { flag: 'wx', mode: 0o600 });
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
    ...(url.searchParams.has('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode') } : {}),
  };
  const result = spawnSync(
    dump,
    [
      '--format=custom',
      '--file=' + path,
      '--host=' + url.hostname,
      '--port=' + (url.port || '5432'),
      '--username=' + decodeURIComponent(url.username),
      '--dbname=' + decodeURIComponent(url.pathname.slice(1)),
      '--no-password',
    ],
    { env, windowsHide: true, timeout: 120000, stdio: 'pipe' },
  );
  if (result.error || result.status !== 0)
    throw Error('pg_dump bajarilmadi. PG_DUMP_PATH, ulanish va disk joyini tekshiring.');
  const verification = spawnSync(restore, ['--list', path], {
    windowsHide: true,
    timeout: 30000,
    stdio: 'pipe',
  });
  if (verification.error || verification.status !== 0)
    throw Error('Backup arxivi tekshiruvdan o‘tmadi. Migratsiyani boshlamang.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const manifest = {
    filename,
    bytes: (await stat(path)).size,
    sha256: hash.digest('hex'),
    archiveListVerified: true,
    createdAt: new Date().toISOString(),
  };
  await writeFile(path + '.json', JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
}
main().catch((error) => {
  const message =
    error instanceof Error &&
    !process.env['DATABASE_URL']?.includes(error.message) &&
    !/postgres(?:ql)?:\/\//i.test(error.message)
      ? error.message
      : 'Backup bajarilmadi.';
  process.stderr.write(message + '\n');
  process.exitCode = 1;
});
