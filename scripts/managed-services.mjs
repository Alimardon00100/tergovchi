import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync, openSync, closeSync, appendFileSync } from 'node:fs';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { getManagedConfig, saveManagedEnvironment, toCygwinPath } from './managed-config.mjs';
import { ensureRedisBinaries } from './portable-assets.mjs';

async function withServiceLock(projectRoot, work) {
  const directory = join(projectRoot, '.local');
  await mkdir(directory, { recursive: true });
  const filename = join(directory, 'services.lock');
  const token = randomUUID();
  let acquired = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await writeFile(filename, JSON.stringify({ pid: process.pid, token }), { flag: 'wx' });
      acquired = true;
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const owner = JSON.parse(await readFile(filename, 'utf8'));
        try {
          process.kill(owner.pid, 0);
        } catch (failure) {
          if (failure.code === 'ESRCH') await unlink(filename);
        }
      } catch (failure) {
        if (failure.code !== 'ENOENT')
          throw new Error(
            'Xizmatlar qulfini tekshirib bo‘lmadi. .local/services.lock ni tekshiring.',
            { cause: failure },
          );
      }
      await delay(500);
    }
  }
  if (!acquired)
    throw new Error('Xizmatlar boshqa oynada tayyorlanmoqda. Birozdan keyin qayta urining.');
  try {
    return await work();
  } finally {
    const owner = JSON.parse(await readFile(filename, 'utf8'));
    if (owner.token === token) await unlink(filename);
  }
}

async function postgresTools() {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error(
      'Avtomatik mahalliy xizmatlar Windows x64 uchun. LOCAL_SERVICES=external ishlating.',
    );
  const require = createRequire(import.meta.url);
  const sdkEntry = require.resolve('embedded-postgres');
  const sdkRequire = createRequire(sdkEntry);
  const binaries = await import(
    pathToFileURL(sdkRequire.resolve('@embedded-postgres/windows-x64')).href
  );
  const { default: EmbeddedPostgres } = await import(pathToFileURL(sdkEntry).href);
  return { ...binaries, EmbeddedPostgres };
}

function nativeCommand(executable, args, log, environment = process.env) {
  // DECISION: pg_ctl avlodlariga pipe qolmasligi uchun log to‘g‘ridan-to‘g‘ri faylga yoziladi.
  const output = openSync(log, 'a');
  let result;
  try {
    result = spawnSync(executable, args, {
      windowsHide: true,
      timeout: 60000,
      env: environment,
      stdio: ['ignore', output, output],
    });
  } finally {
    closeSync(output);
  }
  if (result.error || result.status !== 0) {
    throw new Error(`Mahalliy xizmatni tayyorlab bo‘lmadi. Batafsil: ${log}`);
  }
  return result;
}

function redisCommand(binaries, config, args) {
  return spawnSync(binaries.cli, ['-h', '127.0.0.1', '-p', String(config.redisPort), ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
    env: { ...process.env, REDISCLI_AUTH: config.redisPassword },
  });
}

async function ensurePostgres(projectRoot, config, tools, log) {
  const directory = join(projectRoot, '.local', 'postgres');
  if (!existsSync(join(directory, 'PG_VERSION'))) {
    const passwordFile = join(projectRoot, '.local', `password-${randomUUID()}.tmp`);
    await writeFile(passwordFile, config.password + '\n', { flag: 'wx', mode: 0o600 });
    try {
      nativeCommand(
        tools.initdb,
        [
          '-D',
          directory,
          '-U',
          config.user,
          '--auth=scram-sha-256',
          `--pwfile=${passwordFile}`,
          '--encoding=UTF8',
          '--locale=C',
        ],
        log,
      );
    } finally {
      await unlink(passwordFile);
    }
  }
  const status = spawnSync(tools.pg_ctl, ['-D', directory, 'status'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (status.status !== 0) {
    nativeCommand(
      tools.pg_ctl,
      [
        '-D',
        directory,
        '-l',
        join(projectRoot, '.local', 'postgres.log'),
        '-w',
        '-t',
        '30',
        '-o',
        `-h 127.0.0.1 -p ${config.postgresPort} -c timezone=UTC`,
        'start',
      ],
      log,
    );
  }
  const database = new tools.EmbeddedPostgres({
    databaseDir: directory,
    user: config.user,
    password: config.password,
    port: config.postgresPort,
    persistent: true,
    onError: () => appendFileSync(log, 'PostgreSQL mijozi ulanishida xato.\n'),
  });
  const client = database.getPgClient('postgres', '127.0.0.1');
  try {
    await client.connect();
    const fingerprint = await client.query(
      "SELECT current_setting('data_directory') AS directory, current_setting('server_version_num') AS version",
    );
    const server = fingerprint.rows[0];
    if (
      !server ||
      resolve(server.directory).toLowerCase() !== resolve(directory).toLowerCase() ||
      Math.floor(Number(server.version) / 10000) !== 16
    ) {
      throw new Error('PostgreSQL serveri ushbu loyihaga tegishli emas yoki versiyasi mos emas.');
    }
    for (const name of ['detective', 'detective_test']) {
      const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
      if (existing.rowCount === 0)
        await client.query(`CREATE DATABASE ${client.escapeIdentifier(name)}`);
    }
  } finally {
    await client.end();
  }
}

async function ensureRedis(projectRoot, config, binaries) {
  if (redisCommand(binaries, config, ['PING']).stdout?.trim() === 'PONG') return;
  const data = join(projectRoot, '.local', 'redis');
  await mkdir(data, { recursive: true });
  const filename = join(projectRoot, '.local', 'redis.conf');
  await writeFile(
    filename,
    [
      'bind 127.0.0.1',
      `port ${config.redisPort}`,
      'protected-mode yes',
      `requirepass ${config.redisPassword}`,
      `dir "${toCygwinPath(data)}"`,
      'appendonly yes',
      'appendfsync everysec',
      'save 60 1',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  const output = openSync(join(projectRoot, '.local', 'redis.log'), 'a');
  try {
    const child = spawn(binaries.server, [toCygwinPath(filename)], {
      cwd: dirname(binaries.server),
      detached: true,
      windowsHide: true,
      stdio: ['ignore', output, output],
    });
    await once(child, 'spawn');
    child.unref();
  } finally {
    closeSync(output);
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    const ping = redisCommand(binaries, config, ['PING']);
    if (ping.status === 0 && ping.stdout.trim() === 'PONG') return;
    await delay(200);
  }
  throw new Error('Redis ishga tushmadi. .local/redis.log faylini tekshiring.');
}

export async function ensureManagedServices(projectRoot) {
  return withServiceLock(projectRoot, async () => {
    const config = await getManagedConfig(projectRoot);
    const binaries = await ensureRedisBinaries(projectRoot);
    const tools = await postgresTools();
    const log = join(projectRoot, '.local', 'setup.log');
    process.stdout.write('Loyiha uchun PostgreSQL 16 va Redis 7 tayyorlanmoqda...\n');
    await ensurePostgres(projectRoot, config, tools, log);
    await ensureRedis(projectRoot, config, binaries);
    const values = await saveManagedEnvironment(projectRoot, config);
    process.stdout.write(
      `Mahalliy xizmatlar tayyor: PostgreSQL ${config.postgresPort}, Redis ${config.redisPort}.\n`,
    );
    return values;
  });
}

export async function stopManagedServices(projectRoot) {
  if (!existsSync(join(projectRoot, '.local', 'services.json'))) {
    process.stdout.write('Bu loyiha uchun mahalliy xizmatlar hali yaratilmagan.\n');
    return;
  }
  await withServiceLock(projectRoot, async () => {
    const config = await getManagedConfig(projectRoot);
    const binaries = await ensureRedisBinaries(projectRoot);
    const tools = await postgresTools();
    const ping = redisCommand(binaries, config, ['PING']);
    if (ping.status === 0 && ping.stdout.trim() === 'PONG') {
      const result = redisCommand(binaries, config, ['SHUTDOWN', 'SAVE']);
      if (result.status !== 0) throw new Error('Redisni to‘xtatib bo‘lmadi.');
    }
    const directory = join(projectRoot, '.local', 'postgres');
    const status = spawnSync(tools.pg_ctl, ['-D', directory, 'status'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (status.status === 0)
      nativeCommand(
        tools.pg_ctl,
        ['-D', directory, '-m', 'fast', '-w', '-t', '30', 'stop'],
        join(projectRoot, '.local', 'setup.log'),
      );
    process.stdout.write('Mahalliy xizmatlar to‘xtatildi. Ma’lumotlar saqlandi.\n');
  });
}
