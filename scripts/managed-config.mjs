import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, copyFile, rename } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

export function useManagedServices(environment) {
  if (environment.LOCAL_SERVICES === 'external') return false;
  if (environment.LOCAL_SERVICES === 'managed') return true;
  // DECISION: avvalgi loyiha shabloni avtomatik mahalliy muhitga o‘tadi; boshqa URLlar saqlanadi.
  try {
    const url = new URL(environment.DATABASE_URL);
    return (
      ['127.0.0.1', 'localhost'].includes(url.hostname) &&
      url.port === '15432' &&
      url.pathname === '/detective'
    );
  } catch {
    return false;
  }
}

export function toCygwinPath(path) {
  if (!/^[a-z]:[\\/]/i.test(path)) throw new Error('Windows uchun mutlaq fayl yo‘li kerak.');
  return `/cygdrive/${path[0].toLowerCase()}${path.slice(2).replaceAll('\\', '/')}`;
}

export function serviceUrls(config) {
  const database = new URL(`postgresql://127.0.0.1:${config.postgresPort}/detective?schema=public`);
  database.username = config.user;
  database.password = config.password;
  const test = new URL(database);
  test.pathname = '/detective_test';
  const redis = new URL(`redis://127.0.0.1:${config.redisPort}`);
  redis.password = config.redisPassword;
  return {
    LOCAL_SERVICES: 'managed',
    DATABASE_URL: database.toString(),
    TEST_DATABASE_URL: test.toString(),
    REDIS_URL: redis.toString(),
  };
}

export async function choosePort(preferred) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (error) => {
      if (preferred !== 0 && ['EADDRINUSE', 'EACCES'].includes(error.code)) resolve(choosePort(0));
      else reject(new Error('Mahalliy xizmat uchun port ajratib bo‘lmadi.'));
    });
    server.listen(preferred, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address !== 'string') resolve(address.port);
        else reject(new Error('Mahalliy port aniqlanmadi.'));
      });
    });
  });
}

export async function getManagedConfig(projectRoot) {
  const directory = join(projectRoot, '.local');
  await mkdir(directory, { recursive: true });
  const filename = join(directory, 'services.json');
  if (existsSync(filename)) {
    const config = JSON.parse(await readFile(filename, 'utf8'));
    if (
      config.version !== 1 ||
      config.user !== 'detective' ||
      !/^[a-f0-9]{48}$/.test(config.password) ||
      !/^[a-f0-9]{48}$/.test(config.redisPassword) ||
      ![config.postgresPort, config.redisPort].every(
        (port) => Number.isInteger(port) && port > 0 && port < 65536,
      )
    ) {
      throw new Error(
        'Mahalliy xizmatlar sozlamasi noto‘g‘ri. .local/services.json faylini tekshiring.',
      );
    }
    return config;
  }
  const config = {
    version: 1,
    user: 'detective',
    password: randomBytes(24).toString('hex'),
    redisPassword: randomBytes(24).toString('hex'),
    postgresPort: await choosePort(15432),
    redisPort: await choosePort(16379),
  };
  await writeFile(filename, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return config;
}

export async function saveManagedEnvironment(projectRoot, config) {
  const filename = join(projectRoot, '.env');
  const backup = join(projectRoot, '.env.before-local-services');
  if (!existsSync(backup)) await copyFile(filename, backup, constants.COPYFILE_EXCL);
  let content = await readFile(filename, 'utf8');
  const values = serviceUrls(config);
  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp(`^${key}=.*$`, 'm');
    content = line.test(content)
      ? content.replace(line, () => `${key}=${value}`)
      : content.trimEnd() + `\n${key}=${value}\n`;
  }
  await writeFile(filename + '.local-tmp', content, { mode: 0o600 });
  await rename(filename + '.local-tmp', filename);
  return values;
}
