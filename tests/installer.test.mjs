import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { installPackages } from '../scripts/install-packages.mjs';
const base = resolve('.cache/installer-tests');
async function fixture(mode, work) {
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, 'run-'));
  const filename = join(directory, 'install.cjs');
  const counter = join(directory, 'count.txt');
  const code =
    "const fs = require('node:fs'); const path = require('node:path'); const file = path.join(__dirname, 'count.txt'); const n = fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8')) + 1 : 1; fs.writeFileSync(file, String(n)); const mode = process.env.INSTALL_TEST_MODE; if (mode === 'recover' && n > 1) process.exit(0); process.stderr.write(mode === 'ordinary' ? 'Registry request failed' : 'EPERM: operation not permitted, symlink'); process.exit(1);";
  await writeFile(filename, code);
  try {
    await work(directory, filename, { ...process.env, INSTALL_TEST_MODE: mode }, async () =>
      Number(await readFile(counter, 'utf8')),
    );
  } finally {
    assert.ok(resolve(directory).startsWith(base + sep));
    await rm(directory, { recursive: true, force: true });
  }
}
test('Windowsdagi vaqtinchalik junction xatosidan tiklanadi', async () => {
  await fixture('recover', async (root, cli, env, count) => {
    await installPackages(root, cli, env);
    assert.equal(await count(), 2);
  });
});
test('Tarmoqqa yoki boshqa xatoga qayta urinmaydi', async () => {
  await fixture('ordinary', async (root, cli, env, count) => {
    await assert.rejects(installPackages(root, cli, env), /Kutubxonalar/);
    assert.equal(await count(), 1);
  });
});
test('Doimiy junction xatosida ikkinchi urinishdan so‘ng to‘xtaydi', async () => {
  await fixture('persistent', async (root, cli, env, count) => {
    await assert.rejects(installPackages(root, cli, env), /Kutubxonalar/);
    assert.equal(await count(), 2);
  });
});
