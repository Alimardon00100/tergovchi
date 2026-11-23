import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import shared from '../packages/shared/dist/index.js';

const { BACKGROUNDS, backgroundManifestSchema } = shared;
const sourceDirectory = process.argv[2];
const outputDirectory = process.argv[3]
  ? resolve(process.argv[3])
  : fileURLToPath(new URL('../apps/web/public/assets/backgrounds/', import.meta.url));
const maximumInputBytes = 25 * 1024 * 1024;

async function main() {
  if (!sourceDirectory)
    throw new Error('Rasmlar papkasini ko‘rsating: pnpm assets:import <papka>.');
  const sources = [];
  for (const scene of BACKGROUNDS) {
    const candidates = ['.jpg', '.jpeg', '.png', '.webp'].map((extension) =>
      join(resolve(sourceDirectory), scene.filename + extension),
    );
    const available = [];
    for (const path of candidates) {
      try {
        await access(path);
        available.push(path);
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
          throw error;
      }
    }
    if (available.length !== 1)
      throw new Error(`${scene.filename}: aynan bitta manba rasmi kerak.`);
    const input = await readFile(available[0]);
    if (input.byteLength > maximumInputBytes)
      throw new Error(`${scene.filename}: rasm 25 MB dan katta.`);
    const metadata = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width < 640 ||
      metadata.height < 360 ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new Error(`${scene.filename}: kamida 640×360 o‘lchamdagi statik rasm kerak.`);
    }
    sources.push({ scene, input });
  }
  await mkdir(outputDirectory, { recursive: true });
  const scenes = {};
  for (const { scene, input } of sources) {
    const variants = [];
    const seenWidths = new Set();
    for (const width of [640, 1280, 1920]) {
      const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78, effort: 5 })
        .toBuffer({ resolveWithObject: true });
      if (seenWidths.has(info.width)) continue;
      if (info.size > 600000)
        throw new Error(`${scene.filename}: siqilgan rasm 600 KB chegaradan oshdi.`);
      seenWidths.add(info.width);
      const filename = `${scene.filename}-${info.width}.webp`;
      await writeFile(join(outputDirectory, filename), data);
      variants.push({
        src: `/assets/backgrounds/${filename}`,
        width: info.width,
        height: info.height,
        bytes: info.size,
      });
    }
    scenes[scene.id] = variants;
  }
  const manifest = backgroundManifestSchema.parse({ version: 1, scenes });
  await writeFile(join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write('Olti sahna uchun WebP rasmlar va responsive manifest yaratildi.\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Rasm importida xato.'}\n`);
  process.exitCode = 1;
});
