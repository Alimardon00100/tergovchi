import { createHash, randomBytes } from 'node:crypto';
import { existsSync, openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { choosePort } from './managed-config.mjs';

const workspaceId = (root) =>
  createHash('sha256').update(resolve(root).toLowerCase()).digest('hex').slice(0, 20);
async function health(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    const body = await response.json();
    return body?.data?.workspaceId;
  } catch {
    return null;
  }
}

export async function stopWebServer(projectRoot) {
  const filename = join(projectRoot, '.local', 'web.json');
  if (!existsSync(filename)) return;
  const current = JSON.parse(await readFile(filename, 'utf8'));
  if (!Number.isInteger(current.port) || current.port < 1 || current.port > 65535)
    throw new Error('Web server sozlamasidagi port noto‘g‘ri.');
  if ((await health(current.port)) !== workspaceId(projectRoot)) return;
  const token = (await readFile(join(projectRoot, '.local', 'http-control'), 'utf8')).trim();
  const response = await fetch(`http://127.0.0.1:${current.port}/api/internal/shutdown`, {
    method: 'POST',
    headers: { 'X-Runtime-Token': token },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Web serverni xavfsiz to‘xtatib bo‘lmadi.');
  for (let i = 0; i < 60; i++) {
    if ((await health(current.port)) === null) return;
    await delay(100);
  }
  throw new Error('Avvalgi web server yopilishini kutish vaqti tugadi.');
}

export async function startWebServer(projectRoot, environment, openBrowser) {
  const directory = join(projectRoot, '.local');
  await mkdir(directory, { recursive: true });
  const control = join(directory, 'http-control');
  if (!existsSync(control))
    await writeFile(control, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
  const port = await choosePort(3000);
  const output = openSync(join(directory, 'http.log'), 'a');
  let pid;
  try {
    const child = spawn(
      process.execPath,
      [join(projectRoot, 'apps', 'api', 'dist', 'src', 'main.js')],
      {
        cwd: projectRoot,
        detached: true,
        windowsHide: true,
        stdio: ['ignore', output, output],
        env: {
          ...environment,
          PORT: String(port),
          RUNTIME_ROOT: projectRoot,
          WEB_DIST: join(projectRoot, 'apps', 'web', 'dist'),
          NODE_ENV: 'production',
        },
      },
    );
    await once(child, 'spawn');
    pid = child.pid;
    child.unref();
  } finally {
    closeSync(output);
  }
  await writeFile(
    join(directory, 'web.json'),
    JSON.stringify({ pid, port, workspaceId: workspaceId(projectRoot) }) + '\n',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if ((await health(port)) === workspaceId(projectRoot)) {
      ready = true;
      break;
    }
    await delay(200);
  }
  if (!ready) throw new Error('Brauzer serveri ishga tushmadi. .local/http.log ni tekshiring.');
  const url = `http://127.0.0.1:${port}/board`;
  process.stdout.write(`\nBrauzer interfeysi: ${url}\n`);
  if (openBrowser && process.platform === 'win32') {
    try {
      const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
        detached: true,
        windowsHide: true,
        stdio: 'ignore',
      });
      await once(browser, 'spawn');
      browser.unref();
    } catch (error) {
      process.stderr.write(
        `Brauzerni qo‘lda oching: ${url}. ${error instanceof Error ? error.name : ''}\n`,
      );
    }
  }
  return url;
}
