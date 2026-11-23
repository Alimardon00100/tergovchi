import { existsSync } from 'node:fs';
import { delimiter, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';
import { assertReachable, assertSupportedNode, getServiceTargets } from './local-runtime.mjs';
import { useManagedServices } from './managed-config.mjs';
import { ensureManagedServices } from './managed-services.mjs';
import { startWebServer, stopWebServer } from './web-runtime.mjs';
import { installPackages } from './install-packages.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const environmentFile = join(projectRoot, '.env');

function runNode(args, environment = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new Error('Amal bajarilmadi. Yuqoridagi xato va README.md dagi sozlamalarni tekshiring.');
  }
}

async function main() {
  assertSupportedNode(process.version);
  if (!existsSync(environmentFile)) runNode([join(projectRoot, 'scripts', 'init-env.mjs')]);
  loadEnvFile(environmentFile);
  if (process.argv.includes('--check')) {
    if (
      useManagedServices(process.env) &&
      !existsSync(join(projectRoot, '.local', 'services.json'))
    ) {
      throw new Error('Mahalliy xizmatlar hali yaratilmagan. Avval run.bat ni ishga tushiring.');
    }
    await Promise.all(getServiceTargets(process.env).map((target) => assertReachable(target)));
    process.stdout.write(
      'PostgreSQL va Redis portlari ochiq. Autentifikatsiya db:verify da tekshiriladi.\n',
    );
    return;
  }

  const invokedCli = process.env['npm_execpath'];
  const localCli = join(projectRoot, '.tools', 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');
  const pnpmCli =
    invokedCli && /^pnpm\.(?:cjs|js)$/.test(basename(invokedCli)) ? invokedCli : localCli;
  if (!existsSync(pnpmCli))
    throw new Error('pnpm topilmadi. run.bat orqali ishga tushiring yoki pnpm 9.15.9 o‘rnating.');
  let environment = { ...process.env };
  const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  environment[pathKey] = [
    join(projectRoot, '.tools', 'node_modules', '.bin'),
    environment[pathKey] ?? '',
  ].join(delimiter);

  process.stdout.write('Kutubxonalar tekshirilmoqda...\n');
  await stopWebServer(projectRoot);
  await installPackages(projectRoot, pnpmCli, environment);
  if (useManagedServices(process.env)) {
    const values = await ensureManagedServices(projectRoot);
    Object.assign(process.env, values);
    environment = { ...environment, ...values };
  }
  await Promise.all(getServiceTargets(environment).map((target) => assertReachable(target)));
  for (const args of [
    ['db:generate'],
    ['--filter', '@detective/shared', 'build'],
    ['db:migrate'],
    ['db:seed'],
    ['db:verify'],
    ['--filter', '@detective/web', 'build'],
    ['--filter', '@detective/api', 'build'],
  ])
    runNode([pnpmCli, ...args], environment);

  await startWebServer(projectRoot, environment, !process.argv.includes('--no-browser'));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Ishga tushirishda xato.'}\n`);
  process.exitCode = 1;
});
