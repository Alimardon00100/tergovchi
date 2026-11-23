import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import shared from '../packages/shared/dist/index.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const { BACKGROUNDS, backgroundManifestSchema } = shared;

async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'detective-assets-'));
  try {
    await work(root);
  } finally {
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(target.startsWith(resolve(tmpdir()) + sep));
    assert.ok(basename(target).startsWith('detective-assets-'));
    await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

function run(script, args) {
  const result = spawnSync(process.execPath, [join(projectRoot, 'scripts', script), ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined);
  return result;
}

test('Import: WebP, manifest, responsive o‘lcham va metama’lumotlarni tozalash', async () => {
  await fixture(async (root) => {
    const source = join(root, 'source');
    const output = join(root, 'output');
    await mkdir(source);
    for (const scene of BACKGROUNDS) {
      await sharp({ create: { width: 1400, height: 800, channels: 3, background: '#2a1e14' } })
        .jpeg()
        .withMetadata()
        .toFile(join(source, `${scene.filename}.jpg`));
    }
    const imported = run('import-assets.mjs', [source, output]);
    assert.equal(imported.status, 0, imported.stderr);
    const manifest = backgroundManifestSchema.parse(
      JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')),
    );
    assert.deepEqual(
      manifest.scenes.auth.map((variant) => variant.width),
      [640, 1280, 1400],
    );
    const image = await sharp(await readFile(join(output, 'bg-auth-640.webp'))).metadata();
    assert.equal(image.format, 'webp');
    assert.equal(image.exif, undefined);
    assert.equal(run('check-assets.mjs', [output]).status, 0);
    await writeFile(join(output, 'bg-auth-640.webp'), 'buzilgan rasm');
    assert.equal(run('check-assets.mjs', [output]).status, 1);
  });
});

test('Import: kichik rasmni kattalashtirmaydi va takroriy variant yozmaydi', async () => {
  await fixture(async (root) => {
    const source = join(root, 'source');
    const output = join(root, 'output');
    await mkdir(source);
    for (const scene of BACKGROUNDS) {
      await sharp({ create: { width: 640, height: 360, channels: 3, background: '#14100c' } })
        .png()
        .toFile(join(source, `${scene.filename}.png`));
    }
    const imported = run('import-assets.mjs', [source, output]);
    assert.equal(imported.status, 0, imported.stderr);
    const manifest = backgroundManifestSchema.parse(
      JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')),
    );
    for (const scene of BACKGROUNDS) assert.equal(manifest.scenes[scene.id].length, 1);
  });
});

test('Import: manba yetishmasa yoki fayl rasm bo‘lmasa natijani muvaffaqiyatli deb bermaydi', async () => {
  await fixture(async (root) => {
    const source = join(root, 'source');
    const output = join(root, 'output');
    await mkdir(source);
    assert.equal(run('import-assets.mjs', [source, output]).status, 1);
    await writeFile(join(source, 'bg-auth.jpg'), 'rasm emas');
    assert.equal(run('import-assets.mjs', [source, output]).status, 1);
  });
});
