import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import shared from '../packages/shared/dist/index.js';

const { BACKGROUNDS, backgroundManifestSchema } = shared;
const directory = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('../apps/web/public/assets/backgrounds/', import.meta.url));

async function main() {
  const manifest = backgroundManifestSchema.parse(
    JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')),
  );
  for (const scene of BACKGROUNDS) {
    let previousWidth = 0;
    for (const variant of manifest.scenes[scene.id]) {
      if (
        !variant.src.startsWith(`/assets/backgrounds/${scene.filename}-`) ||
        variant.width <= previousWidth
      ) {
        throw new Error(`${scene.filename}: manba yoki o‘lchamlar tartibi noto‘g‘ri.`);
      }
      const data = await readFile(join(directory, variant.src.split('/').at(-1)));
      const metadata = await sharp(data).metadata();
      if (
        metadata.format !== 'webp' ||
        metadata.width !== variant.width ||
        metadata.height !== variant.height ||
        data.byteLength !== variant.bytes
      ) {
        throw new Error(`${scene.filename}: fayl va manifest bir-biriga mos emas.`);
      }
      previousWidth = variant.width;
    }
  }
  process.stdout.write('Barcha olti sahna rasmi tekshirildi.\n');
}

main().catch((error) => {
  const missing = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
  process.stderr.write(
    missing
      ? 'Rasmlar hali import qilinmagan yoki fayl yetishmaydi. docs/assets.md hujjatini ko‘ring.\n'
      : `${error instanceof Error ? error.message : 'Rasm tekshiruvida xato.'}\n`,
  );
  process.exitCode = 1;
});
