import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = fileURLToPath(new URL('../apps/web/public/photos/', import.meta.url));
const photos = {
  hero: 'photo-1519501025264-65ba15a82390',
  letter: 'photo-1455390582262-044cdead277a',
  station: 'photo-1474487548417-781cb71495f3',
  museum: 'photo-1561214115-f2f134cc4912',
  city: 'photo-1477959858617-67f85cf4f1df',
  archive: 'photo-1507842217343-583bb7270b66',
};
await mkdir(directory, { recursive: true });
for (const [name, photo] of Object.entries(photos)) {
  const destination = new URL(`../apps/web/public/photos/${name}.webp`, import.meta.url);
  try {
    await access(destination);
    continue;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const response = await fetch(
    `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${name === 'hero' ? 1400 : 800}&q=85`,
    { signal: AbortSignal.timeout(60000) },
  );
  if (!response.ok) throw new Error(`${name}: rasm yuklanmadi.`);
  const output = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize({ width: name === 'hero' ? 1400 : 800, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await writeFile(destination, output);
  process.stdout.write(`${name}.webp tayyor.\n`);
}
