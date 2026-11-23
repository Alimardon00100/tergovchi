import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import sharp from 'sharp';
export const MEDIA_ROOT = Symbol('MEDIA_ROOT');
const MAX_BYTES = 4 * 1024 * 1024;
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const validKey = new RegExp(`^(avatars|cases)/${uuid}/${uuid}\\.webp$`);
type UploadKind = 'avatars' | 'cases';
export const mediaUrl = (key: string | null) =>
  key && validKey.test(key) ? `/api/media/${key}` : null;
@Injectable()
export class MediaService {
  constructor(@Inject(MEDIA_ROOT) private readonly root: string) {}
  async upload(request: FastifyRequest, withData: boolean) {
    if (!request.isMultipart()) throw new BadRequestException('Rasm yuklash majburiy.');
    let image: Buffer | undefined;
    let mime = '';
    let data: unknown;
    let dataFound = false;
    try {
      for await (const part of request.parts({
        limits: {
          files: 1,
          fields: withData ? 1 : 0,
          parts: withData ? 2 : 1,
          fileSize: MAX_BYTES,
          fieldSize: 65536,
        },
      })) {
        if (part.type === 'file') {
          if (part.fieldname !== 'image') throw new BadRequestException('Rasm maydoni noto‘g‘ri.');
          mime = part.mimetype;
          image = await part.toBuffer();
          if (part.file.truncated) throw new PayloadTooLargeException('Rasm 4 MB dan oshmasin.');
        } else {
          if (
            !withData ||
            part.fieldname !== 'data' ||
            typeof part.value !== 'string' ||
            part.valueTruncated
          )
            throw new BadRequestException('Ma’lumot maydoni noto‘g‘ri.');
          data = JSON.parse(part.value) as unknown;
          dataFound = true;
        }
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'FST_REQ_FILE_TOO_LARGE'
      )
        throw new PayloadTooLargeException('Rasm 4 MB dan oshmasin.');
      throw new BadRequestException('Rasm yoki yuklash shakli noto‘g‘ri.');
    }
    if (!image?.length || (withData && !dataFound))
      throw new BadRequestException('Rasm va ish ma’lumotlari majburiy.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime))
      throw new BadRequestException('JPG, PNG yoki WebP rasm tanlang.');
    try {
      const metadata = await sharp(image, {
        limitInputPixels: 20000000,
        failOn: 'error',
      }).metadata();
      const expected: Record<string, string> = {
        'image/jpeg': 'jpeg',
        'image/png': 'png',
        'image/webp': 'webp',
      };
      if (
        metadata.format !== expected[mime] ||
        !metadata.width ||
        !metadata.height ||
        metadata.width < 64 ||
        metadata.height < 64 ||
        (metadata.pages ?? 1) !== 1
      )
        throw new Error('Unsupported image');
    } catch {
      throw new BadRequestException('Statik va buzilmagan, kamida 64×64 rasm tanlang.');
    }
    return { image, data };
  }
  private path(key: string) {
    if (!validKey.test(key)) throw new NotFoundException();
    const root = resolve(this.root);
    const filename = resolve(root, key);
    if (!filename.startsWith(root + sep)) throw new NotFoundException();
    return filename;
  }
  async save(kind: UploadKind, owner: string, image: Buffer) {
    const key = `${kind}/${owner}/${randomUUID()}.webp`;
    const filename = this.path(key);
    let bytes: Buffer;
    try {
      const picture = sharp(image, { limitInputPixels: 20000000, failOn: 'error' }).rotate();
      bytes = await (
        kind === 'avatars'
          ? picture.resize(512, 512, { fit: 'cover' })
          : picture.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      )
        .webp({ quality: 86 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Rasm fayli buzilgan yoki to‘liq yuklanmagan.');
    }
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, bytes, { flag: 'wx', mode: 0o600 });
    return key;
  }
  async read(key: string) {
    try {
      const filename = await realpath(this.path(key));
      const root = await realpath(resolve(this.root));
      if (!filename.startsWith(root + sep)) throw new NotFoundException();
      return await readFile(filename);
    } catch {
      throw new NotFoundException('Rasm topilmadi.');
    }
  }
  async remove(key: string | null) {
    if (!key || !validKey.test(key)) return;
    try {
      await unlink(this.path(key));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
}
