import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readdir, writeFile, unlink, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import * as tar from 'tar';
import pino from 'pino';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { HTTP_OPTIONS } from '../http/controllers';
import type { HttpOptions } from '../http/controllers';
import { Database } from '../http/database';
const logger = pino();
const magic = Buffer.from('TERGOV-BACKUP-1\n');
export function openBackup(input: Buffer, secret: string) {
  if (!input.subarray(0, magic.length).equals(magic)) throw Error('Backup format invalid');
  const offset = magic.length,
    key = createHash('sha256')
      .update('case-backup-v1:' + secret)
      .digest(),
    decipher = createDecipheriv('aes-256-gcm', key, input.subarray(offset, offset + 12));
  decipher.setAuthTag(input.subarray(offset + 12, offset + 28));
  return Buffer.concat([decipher.update(input.subarray(offset + 28)), decipher.final()]);
}
export async function createCaseBackup(db: PrismaClient, local: string, secret: string) {
  const directory = resolve(local, 'backups');
  await mkdir(directory, { recursive: true });
  const schema =
    new URL(process.env['DATABASE_URL'] ?? 'postgresql://localhost/db').searchParams.get(
      'schema',
    ) ?? 'public';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw Error('Schema identifier invalid');
  const snapshot = await db.$transaction(
    async (tx) => {
      const tables = await tx.$queryRaw<
        { table_name: string }[]
      >`SELECT table_name FROM information_schema.tables WHERE table_schema=${schema} AND table_type='BASE TABLE' ORDER BY table_name`;
      const data: { name: string; rows: string }[] = [];
      for (const table of tables) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table.table_name))
          throw Error('Table identifier invalid');
        const rows = await tx.$queryRawUnsafe<{ rows: string }[]>(
          `SELECT COALESCE(json_agg(t),'[]'::json)::text AS rows FROM "${schema}"."${table.table_name}" t`,
        );
        data.push({ name: table.table_name, rows: rows[0]?.rows ?? '[]' });
      }
      return { version: 1, createdAt: new Date().toISOString(), schema, tables: data };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120000 },
  );
  const manifest = `backup-work-${randomUUID()}.json`,
    manifestPath = join(local, manifest);
  await writeFile(manifestPath, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
  try {
    const files = [manifest];
    for (const name of ['case-files', 'uploads', 'http-secret']) {
      try {
        await stat(join(local, name));
        files.push(name);
      } catch (e) {
        if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e;
      }
    }
    const stream = tar.c({ cwd: local, gzip: true, portable: true, follow: false }, files);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const iv = randomBytes(12),
      key = createHash('sha256')
        .update('case-backup-v1:' + secret)
        .digest(),
      cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.concat(chunks)), cipher.final()]);
    const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.case-backup`;
    await writeFile(
      join(directory, filename),
      Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]),
      { flag: 'wx', mode: 0o600 },
    );
    const cutoff = Date.now() - 30 * 86400000;
    for (const name of await readdir(directory)) {
      if (!/^\d{4}-\d\d-\d\dT[\dTZ-]+-[\da-f-]{36}\.case-backup$/.test(name)) continue;
      const path = join(directory, name);
      if ((await stat(path)).mtimeMs < cutoff) await unlink(path);
    }
    return {
      filename,
      tables: snapshot.tables.length,
      bytes: magic.length + 28 + encrypted.length,
    };
  } finally {
    await unlink(manifestPath);
  }
}
@Injectable()
export class CaseBackup implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private day = '';
  constructor(
    @Inject(Database) readonly db: Database,
    @Inject(HTTP_OPTIONS) readonly options: HttpOptions,
  ) {}
  onModuleInit() {
    if (!this.options.backupEnabled) return;
    this.timer = setInterval(() => void this.check(), 60000);
    this.timer.unref();
    void this.check();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async check() {
    if (this.running) return;
    const day = new Date().toISOString().slice(0, 10);
    if (this.day === day) return;
    this.running = true;
    try {
      const local = dirname(this.options.mediaDirectory ?? resolve('.local/uploads'));
      const directory = join(local, 'backups');
      await mkdir(directory, { recursive: true });
      if (
        !(await readdir(directory)).some(
          (name) => name.startsWith(day + 'T') && name.endsWith('.case-backup'),
        )
      )
        await createCaseBackup(this.db, local, this.options.secret);
      this.day = day;
    } catch {
      logger.error(
        { event: 'legal.backup.failed' },
        'Kunlik nusxa yaratilmadi. Disk va baza ulanishini tekshiring.',
      );
    } finally {
      this.running = false;
    }
  }
}
