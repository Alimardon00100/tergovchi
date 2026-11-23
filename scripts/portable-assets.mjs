import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const REDIS_ASSET = Object.freeze({
  version: '7.2.16',
  bytes: 11703328,
  sha256: 'ccbb1d2fdbdc339c26cb369723b54c2fe23291136e8d9ca293345960742e864c',
  url: 'https://github.com/redis-windows/redis-windows/releases/download/7.2.16/Redis-7.2.16-Windows-x64-cygwin.zip',
});

export function verifyRedisArchive(data) {
  return (
    data.byteLength === REDIS_ASSET.bytes &&
    createHash('sha256').update(data).digest('hex') === REDIS_ASSET.sha256
  );
}

export function assertSafeArchiveEntry(entry) {
  const normalized = entry.replaceAll('\\', '/');
  if (
    normalized.startsWith('/') ||
    /^[a-z]:/i.test(normalized) ||
    normalized.split('/').includes('..')
  ) {
    throw new Error('Arxiv ichida xavfsiz bo‘lmagan fayl yo‘li topildi.');
  }
}

async function findExecutable(directory, filename, depth = 0) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === filename) return path;
    if (entry.isDirectory() && depth < 3) {
      const result = await findExecutable(path, filename, depth + 1);
      if (result) return result;
    }
  }
  return null;
}

export async function ensureRedisBinaries(projectRoot) {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error(
      'Avtomatik xizmatlar Windows x64 uchun. Boshqa muhitda LOCAL_SERVICES=external ishlating.',
    );
  }
  const directory = join(projectRoot, '.tools', `redis-${REDIS_ASSET.version}`);
  const marker = join(directory, 'verified.json');
  if (existsSync(marker)) {
    const verified = JSON.parse(await readFile(marker, 'utf8'));
    const server = await findExecutable(directory, 'redis-server.exe');
    const cli = await findExecutable(directory, 'redis-cli.exe');
    if (verified.sha256 === REDIS_ASSET.sha256 && server && cli) return { server, cli };
  }
  const downloads = join(projectRoot, '.cache', 'downloads');
  const archive = join(downloads, `redis-${REDIS_ASSET.version}.zip`);
  await mkdir(downloads, { recursive: true });
  let data = existsSync(archive) ? await readFile(archive) : null;
  if (!data || !verifyRedisArchive(data)) {
    process.stdout.write('Redis 7 mahalliy paketi yuklanmoqda...\n');
    const response = await fetch(REDIS_ASSET.url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body)
      throw new Error('Redis paketini yuklab bo‘lmadi. Internet ulanishini tekshiring.');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > REDIS_ASSET.bytes) throw new Error('Redis arxivi kutilgan hajmdan katta.');
      chunks.push(chunk);
    }
    data = Buffer.concat(chunks);
    if (!verifyRedisArchive(data)) throw new Error('Redis paketining SHA-256 tekshiruvi o‘tmadi.');
    await writeFile(archive + '.part', data);
    await rename(archive + '.part', archive);
  }
  const listing = spawnSync('tar.exe', ['-tf', archive], { encoding: 'utf8', windowsHide: true });
  if (listing.error || listing.status !== 0)
    throw new Error('Windows tar.exe vositasi bilan arxivni o‘qib bo‘lmadi.');
  listing.stdout.split(/\r?\n/).filter(Boolean).forEach(assertSafeArchiveEntry);
  await mkdir(directory, { recursive: true });
  const extraction = spawnSync('tar.exe', ['-xf', archive, '-C', directory], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (extraction.error || extraction.status !== 0)
    throw new Error('Redis arxivini ochib bo‘lmadi.');
  const server = await findExecutable(directory, 'redis-server.exe');
  const cli = await findExecutable(directory, 'redis-cli.exe');
  if (!server || !cli) throw new Error('Redis bajariluvchi fayllari topilmadi.');
  await writeFile(marker, JSON.stringify({ sha256: REDIS_ASSET.sha256 }) + '\n');
  return { server, cli };
}
