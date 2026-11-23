import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { PDFDocument, PDFName } from 'pdf-lib';
import { documentCreateSchema } from '@detective/shared';
import type { FastifyRequest } from 'fastify';
import { HTTP_OPTIONS, parseInput } from '../http/controllers';
import type { HttpOptions } from '../http/controllers';
import { CaseService, assertRead, audit, lockedFile } from './case.service';
import type { CaseActor } from './case.service';
@Injectable()
export class CaseDocuments {
  readonly root: string;
  constructor(
    @Inject(CaseService) readonly cases: CaseService,
    @Inject(HTTP_OPTIONS) options: HttpOptions,
  ) {
    this.root = resolve(
      options.caseFilesDirectory ??
        join(dirname(options.mediaDirectory ?? resolve('.local/uploads')), 'case-files'),
    );
  }
  async list(actor: CaseActor, id: string) {
    const file = await this.cases.file(id);
    assertRead(actor, file);
    const rows = await this.cases.db.caseDocument.findMany({
      where: { caseId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const expires = Date.now() + 900000;
    await audit(this.cases.db, actor, 'DOCUMENTS_READ', id);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      mime: row.mime,
      bytes: row.bytes,
      isEvidence: row.isEvidence,
      createdAt: row.createdAt.toISOString(),
      expiresAt: new Date(expires).toISOString(),
      signedUrl: `/api/v1/cases/${id}/documents/${row.id}/file?token=${this.cases.crypto.sign({ documentId: row.id, caseId: id, userId: actor.id, sha256: row.sha256, expires })}`,
    }));
  }
  path(key: string) {
    const path = resolve(this.root, key);
    if (
      !path.startsWith(this.root + sep) ||
      !/^[-0-9a-f]{36}\/[-0-9a-f]{36}\.(pdf|webp)$/.test(key)
    )
      throw new ForbiddenException('Hujjat manzili yaroqsiz.');
    return path;
  }
  async file(actor: CaseActor, id: string, documentId: string, token: string) {
    await this.cases.expire(id);
    const row = await this.cases.db.caseDocument.findFirst({
      where: { id: documentId, caseId: id },
    });
    if (!row) throw new NotFoundException('Hujjat topilmadi.');
    this.cases.crypto.verify(token, {
      documentId,
      caseId: id,
      userId: actor.id,
      sha256: row.sha256,
    });
    const data = await readFile(this.path(row.storageKey)).catch(() => {
      throw new NotFoundException('Hujjat fayli topilmadi.');
    });
    if (createHash('sha256').update(data).digest('hex') !== row.sha256)
      throw new ConflictException('Hujjat yaxlitligi buzilgan.');
    await this.cases.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      assertRead(actor, file);
      if (
        actor.role === 'USER' &&
        !['CLOSED', 'SUSPENDED'].includes(file.status) &&
        (!file.lock || file.lock.lockedBy !== actor.id || file.lock.expiresAt <= new Date())
      )
        throw new ConflictException('Hujjatni ochish uchun ishni qayta oling.');
      if (actor.role === 'USER' && file.status === 'ASSIGNED') {
        await tx.caseFile.update({ where: { id }, data: { status: 'IN_INVESTIGATION' } });
        await audit(tx, actor, 'INVESTIGATION_STARTED', id, { documentId });
      }
      await audit(tx, actor, 'DOCUMENT_OPENED', id, { documentId });
    });
    return { data, mime: row.mime };
  }
  async upload(actor: CaseActor, id: string, request: FastifyRequest) {
    if (actor.role !== 'ADMIN')
      throw new ForbiddenException('Hujjatni faqat administrator yuklaydi.');
    let file: Buffer | undefined,
      mime = '',
      metadata: unknown;
    try {
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file')
            throw new BadRequestException('Fayl maydoni file bo‘lsin.');
          file = await part.toBuffer();
          mime = part.mimetype;
          if (part.file.truncated) throw new BadRequestException('Fayl 4 MB dan oshmasin.');
        } else {
          if (part.fieldname !== 'data' || typeof part.value !== 'string')
            throw new BadRequestException('Hujjat metama’lumotlari noto‘g‘ri.');
          metadata = JSON.parse(part.value) as unknown;
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Yuklashni tekshiring: bitta fayl, 4 MB gacha.');
    }
    if (!file) throw new BadRequestException('Hujjat faylini tanlang.');
    const input = parseInput(documentCreateSchema, metadata);
    const clean = await sanitizeDocument(file, mime);
    const docId = randomUUID(),
      storageKey = `${id}/${docId}.${clean.mime === 'application/pdf' ? 'pdf' : 'webp'}`;
    const path = this.path(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, clean.data, { flag: 'wx', mode: 0o600 });
    try {
      return await this.cases.db.$transaction(async (tx) => {
        const file = await lockedFile(tx, id);
        if (file.status !== 'NEW')
          throw new ConflictException('Hujjatlar ish biriktirilishidan oldin yuklanadi.');
        await tx.caseDocument.create({
          data: {
            id: docId,
            caseId: id,
            ...input,
            storageKey,
            mime: clean.mime,
            sha256: createHash('sha256').update(clean.data).digest('hex'),
            bytes: clean.data.length,
            authorId: actor.id,
          },
        });
        await audit(tx, actor, 'DOCUMENT_CREATED', id, {
          documentId: docId,
          type: input.type,
          bytes: clean.data.length,
        });
        return { id: docId };
      });
    } catch (e) {
      await unlink(path).catch(() => undefined);
      throw e;
    }
  }
}
export async function sanitizeDocument(input: Buffer, mime: string) {
  if (input.length > 4 * 1024 * 1024) throw new BadRequestException('Fayl 4 MB dan oshmasin.');
  if (mime === 'application/pdf')
    try {
      if (!input.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw Error('Signature');
      const doc = await PDFDocument.load(input);
      if (doc.getPageCount() < 1 || doc.getPageCount() > 100) throw Error('Pages');
      for (const key of ['OpenAction', 'AA', 'Names', 'AcroForm'])
        doc.catalog.delete(PDFName.of(key));
      for (const page of doc.getPages())
        for (const key of ['AA', 'Annots']) page.node.delete(PDFName.of(key));
      return { data: Buffer.from(await doc.save()), mime: 'application/pdf' };
    } catch {
      throw new BadRequestException('PDF buzilgan, shifrlangan yoki 100 sahifadan ko‘p.');
    }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime))
    throw new BadRequestException('Faqat PDF, JPEG, PNG yoki WebP yuklang.');
  try {
    return {
      data: await sharp(input, { limitInputPixels: 25000000, animated: false })
        .rotate()
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer(),
      mime: 'image/webp',
    };
  } catch {
    throw new BadRequestException('Rasmni o‘qib bo‘lmadi.');
  }
}
