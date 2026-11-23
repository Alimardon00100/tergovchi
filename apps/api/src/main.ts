import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pino from 'pino';
import { createApi } from './http/application';

const logger = pino();
async function main() {
  const projectRoot = process.env['RUNTIME_ROOT'] ?? process.cwd();
  const directory = join(projectRoot, '.local');
  mkdirSync(directory, { recursive: true });
  const secretFile = join(directory, 'http-secret');
  if (!existsSync(secretFile))
    writeFileSync(secretFile, randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
  const token = readFileSync(join(directory, 'http-control'), 'utf8').trim();
  const secret = process.env['JWT_SECRET'] ?? readFileSync(secretFile, 'utf8').trim();
  const app = await createApi({
    secret,
    backupEnabled: true,
    workspaceId: createHash('sha256')
      .update(resolve(projectRoot).toLowerCase())
      .digest('hex')
      .slice(0, 20),
    controlToken: token,
    mediaDirectory: join(projectRoot, '.local', 'uploads'),
    webDirectory: process.env['WEB_DIST'] ?? resolve(__dirname, '../../../web/dist'),
    shutdown: () => {
      void app.close().then(() => process.exit(0));
    },
  });
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port, '127.0.0.1');
  logger.info({ port, event: 'web.started' }, 'Brauzer interfeysi ishga tushdi.');
}
main().catch((error: unknown) => {
  logger.error(
    {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Noma’lum xato',
    },
    'HTTP server ishga tushmadi.',
  );
  process.exitCode = 1;
});
