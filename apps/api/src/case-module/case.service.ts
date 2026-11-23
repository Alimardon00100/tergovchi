import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CaseFileStatus, User, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  casePreviewSchema,
  caseWorkspaceSchema,
  caseMetaSchema,
  personViewSchema,
  adminUsersSchema,
  auditListSchema,
} from '@detective/shared';
import type { PublicUser, CaseListQuery, CaseFileCreate, PersonCreate } from '@detective/shared';
import { Database, publicUser } from '../http/database';
import { CaseCrypto } from './crypto';
export type CaseActor = Pick<User, 'id' | 'role' | 'departmentId' | 'displayName'> & {
  requestId: string;
  ip: string | null;
};
export type Tx = Prisma.TransactionClient;
export const fileInclude = {
  assignee: { select: { id: true, displayName: true } },
  department: true,
  lock: true,
  episodes: {
    orderBy: { episodeNumber: 'asc' as const },
    include: { _count: { select: { references: true } } },
  },
  _count: { select: { scores: true } },
} as const;
export type FileRow = Prisma.CaseFileGetPayload<{ include: typeof fileInclude }>;
export const isPrivileged = (role: UserRole) => ['ADMIN', 'PROSECUTOR', 'AUDITOR'].includes(role);
export function assertRead(actor: CaseActor, file: FileRow) {
  if (!(
    isPrivileged(actor.role) ||
    (actor.role === 'HEAD' && actor.departmentId === file.departmentId) ||
    (actor.role === 'USER' && actor.id === file.assignedTergovchiId)
  ))
    throw new ForbiddenException('Bu ish sizga biriktirilmagan.');
}
export function editable(actor: CaseActor, file: FileRow) {
  return (
    actor.role === 'USER' &&
    file.assignedTergovchiId === actor.id &&
    file.lock?.lockedBy === actor.id &&
    file.lock.expiresAt > new Date() &&
    file.deadlineAt > new Date() &&
    ['ASSIGNED', 'IN_INVESTIGATION', 'SCORED'].includes(file.status) &&
    file._count.scores < 3
  );
}
export function assertEdit(actor: CaseActor, file: FileRow) {
  if (actor.role !== 'USER')
    throw new ForbiddenException('Kvalifikatsiyani faqat tergovchi kiritadi.');
  assertRead(actor, file);
  if (!editable(actor, file))
    throw new ConflictException('Ishni qayta oling yoki muddat va urinishlar sonini tekshiring.');
}
export async function audit(
  tx: Tx,
  actor: CaseActor,
  action: string,
  targetId: string | null,
  metadata: Prisma.InputJsonObject = {},
) {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'LEGAL_' + action,
      targetType: 'CASE_FILE',
      targetId,
      requestId: actor.requestId,
      ip: actor.ip,
      metadata,
    },
  });
}
export async function lockedFile(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "CaseFile" WHERE id=${id}::uuid FOR UPDATE`;
  const file = await tx.caseFile.findUnique({ where: { id }, include: fileInclude });
  if (!file) throw new NotFoundException('Jinoyat ishi topilmadi.');
  return file;
}
@Injectable()
export class CaseService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(
    @Inject(Database) readonly db: Database,
    @Inject(CaseCrypto) readonly crypto: CaseCrypto,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.expire().catch(() => undefined);
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async actor(user: PublicUser, requestId: string, ip: string | undefined): Promise<CaseActor> {
    const row = await this.db.user.findUniqueOrThrow({ where: { id: user.id } });
    return {
      id: row.id,
      role: row.role,
      departmentId: row.departmentId,
      displayName: row.displayName,
      requestId,
      ip: ip?.slice(0, 45) ?? null,
    };
  }
  async expire(id?: string) {
    const rows = await this.db.caseFile.findMany({
      where: {
        ...(id ? { id } : {}),
        deadlineAt: { lte: new Date() },
        status: { notIn: ['CLOSED', 'SUSPENDED'] },
      },
      select: { id: true },
      take: 100,
    });
    for (const row of rows)
      await this.db.$transaction(async (tx) => {
        const file = await lockedFile(tx, row.id);
        if (file.deadlineAt > new Date() || ['CLOSED', 'SUSPENDED'].includes(file.status)) return;
        await tx.caseFile.update({
          where: { id: file.id },
          data: {
            status: 'SUSPENDED',
            suspendedFrom: file.status,
            suspendedReason: 'Protsessual muddat tugagan.',
          },
        });
        await tx.caseLock.deleteMany({ where: { caseId: file.id } });
        await tx.auditLog.create({
          data: {
            action: 'LEGAL_DEADLINE_SUSPENDED',
            targetType: 'CASE_FILE',
            targetId: file.id,
            requestId: randomUUID(),
            metadata: { from: file.status },
          },
        });
      });
  }
  async file(id: string) {
    await this.expire(id);
    const file = await this.db.caseFile.findUnique({ where: { id }, include: fileInclude });
    if (!file) throw new NotFoundException('Jinoyat ishi topilmadi.');
    return file;
  }
  preview(actor: CaseActor, file: FileRow) {
    const canEnter =
      isPrivileged(actor.role) ||
      (actor.role === 'HEAD' && actor.departmentId === file.departmentId) ||
      (actor.role === 'USER' && file.assignedTergovchiId === actor.id);
    const canTake =
      actor.role === 'USER' &&
      actor.departmentId === file.departmentId &&
      file.deadlineAt > new Date() &&
      ((file.status === 'NEW' && !file.assignedTergovchiId) ||
        (file.assignedTergovchiId === actor.id &&
          !['CLOSED', 'SUSPENDED'].includes(file.status))) &&
      (!file.lock || file.lock.lockedBy === actor.id || file.lock.expiresAt <= new Date());
    return casePreviewSchema.parse({
      id: file.id,
      caseNumber: file.caseNumber,
      title: file.title,
      summary: file.summary,
      initialFacts: file.initialFacts,
      status: file.status,
      openedAt: file.openedAt.toISOString(),
      deadlineAt: file.deadlineAt.toISOString(),
      closedAt: file.closedAt?.toISOString() ?? null,
      jkArticles: file.jkArticles,
      episodeCount: file.episodes.length,
      assignee: file.assignee,
      department: file.department,
      lock: file.lock
        ? {
            lockedBy: file.lock.lockedBy,
            lockedAt: file.lock.lockedAt.toISOString(),
            expiresAt: file.lock.expiresAt.toISOString(),
          }
        : null,
      canTake,
      canEnter,
      blockReason: canTake
        ? null
        : file.status === 'SUSPENDED'
          ? 'Ish to‘xtatilgan.'
          : file.status === 'CLOSED'
            ? 'Ish yopilgan.'
            : file.assignedTergovchiId && file.assignedTergovchiId !== actor.id
              ? 'Ish boshqa tergovchida.'
              : actor.role !== 'USER'
                ? 'Ishni faqat tergovchi oladi.'
                : 'Bo‘linma yoki ish muddatini tekshiring.',
    });
  }
  async meta(actor: CaseActor, user: PublicUser) {
    const [department, departments, investigators] = await Promise.all([
      this.db.department.findUniqueOrThrow({ where: { id: actor.departmentId } }),
      this.db.department.findMany({ orderBy: { code: 'asc' } }),
      this.db.user.findMany({
        where: {
          role: 'USER',
          bannedAt: null,
          ...(!isPrivileged(actor.role) ? { departmentId: actor.departmentId } : {}),
        },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' },
        take: 200,
      }),
    ]);
    await audit(this.db, actor, 'META_READ', null);
    return caseMetaSchema.parse({ user, department, departments, investigators });
  }
  async list(actor: CaseActor, query: CaseListQuery) {
    await this.expire();
    const where: Prisma.CaseFileWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.jkArticle ? { jkArticles: { has: query.jkArticle } } : {}),
      ...(query.investigatorId ? { assignedTergovchiId: query.investigatorId } : {}),
      ...(query.from || query.to
        ? {
            openedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(Date.parse(query.to) + 86400000) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.caseFile.findMany({
        where,
        include: fileInclude,
        orderBy: [{ openedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.caseFile.count({ where }),
    ]);
    await audit(this.db, actor, 'LIST', null, { page: query.page, status: query.status ?? null });
    return {
      items: items.map((file) => this.preview(actor, file)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      serverTime: new Date().toISOString(),
    };
  }
  async getPreview(actor: CaseActor, id: string) {
    const file = await this.file(id);
    await audit(this.db, actor, 'PREVIEW', id);
    return this.preview(actor, file);
  }
  async workspace(actor: CaseActor, id: string) {
    const file = await this.file(id);
    assertRead(actor, file);
    await audit(this.db, actor, 'WORKSPACE_READ', id);
    return caseWorkspaceSchema.parse({
      case: this.preview(actor, file),
      episodes: file.episodes.map((e) => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        description: e.description,
        jkArticle: e.jkArticle,
        location: e.location,
        dateTime: e.dateTime.toISOString(),
        weight: Number(e.weight),
      })),
      permissions: {
        canEdit: editable(actor, file),
        canApprove:
          actor.role === 'HEAD' &&
          actor.departmentId === file.departmentId &&
          file.status === 'SCORED',
        canReassign:
          actor.role === 'HEAD' &&
          actor.departmentId === file.departmentId &&
          !['CLOSED', 'SUSPENDED'].includes(file.status),
        canManage: actor.role === 'ADMIN',
      },
      attemptsUsed: file._count.scores,
      referenceReady:
        file.episodes.reduce((sum, e) => sum + e._count.references, 0) === file.episodes.length * 5,
      serverTime: new Date().toISOString(),
    });
  }
  async claim(actor: CaseActor, id: string) {
    await this.expire(id);
    return this.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      if (actor.role !== 'USER' || actor.departmentId !== file.departmentId)
        throw new ForbiddenException('Ishni faqat shu bo‘linma tergovchisi oladi.');
      if (['CLOSED', 'SUSPENDED'].includes(file.status) || file.deadlineAt <= new Date())
        throw new ConflictException('Ish yopilgan yoki muddati tugagan.');
      if (
        (file.assignedTergovchiId && file.assignedTergovchiId !== actor.id) ||
        (file.lock && file.lock.lockedBy !== actor.id && file.lock.expiresAt > new Date())
      )
        throw new ConflictException('Ish boshqa tergovchida.');
      const now = new Date(),
        expiresAt = new Date(now.getTime() + 86400000);
      await tx.caseLock.upsert({
        where: { caseId: id },
        create: { caseId: id, lockedBy: actor.id, lockedAt: now, expiresAt },
        update: { lockedBy: actor.id, lockedAt: now, expiresAt },
      });
      await tx.caseFile.update({
        where: { id },
        data: {
          assignedTergovchiId: actor.id,
          ...(file.status === 'NEW' ? { status: 'ASSIGNED' } : {}),
        },
      });
      await audit(tx, actor, 'LOCK_ACQUIRED', id, { expiresAt: expiresAt.toISOString() });
      return this.preview(actor, await lockedFile(tx, id));
    });
  }
  async release(actor: CaseActor, id: string) {
    return this.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      if (file.lock?.lockedBy !== actor.id || actor.role !== 'USER')
        throw new ForbiddenException('Qulf sizga tegishli emas.');
      await tx.caseLock.delete({ where: { caseId: id } });
      await audit(tx, actor, 'LOCK_RELEASED', id);
      return { released: true };
    });
  }
  async persons(actor: CaseActor, id: string) {
    const file = await this.file(id);
    assertRead(actor, file);
    const rows = await this.db.casePerson.findMany({
      where: { caseId: id },
      include: { person: true },
      orderBy: { person: { fullName: 'asc' } },
    });
    await audit(this.db, actor, 'PERSONS_READ', id, { masked: actor.role === 'AUDITOR' });
    return rows.map((row) => {
      const p = row.person,
        masked = actor.role === 'AUDITOR';
      return personViewSchema.parse({
        id: p.id,
        fullName: p.fullName,
        birthDate: p.birthDate.toISOString().slice(0, 10),
        gender: p.gender,
        address: masked ? '[MANZIL YASHIRILGAN]' : this.crypto.decrypt(p.addressEncrypted),
        pinfl: masked
          ? p.pinflLast4
            ? '**********' + p.pinflLast4
            : null
          : p.pinflEncrypted
            ? this.crypto.decrypt(p.pinflEncrypted)
            : null,
        photoUrl: p.photoUrl,
        role: row.role,
        masked,
      });
    });
  }
  async create(actor: CaseActor, input: CaseFileCreate) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Faqat administrator ish yaratadi.');
    if (!(await this.db.department.findUnique({ where: { id: input.departmentId } })))
      throw new BadRequestException('Bo‘linma topilmadi.');
    try {
      return await this.db.$transaction(async (tx) => {
        const { episodes, ...data } = input;
        const row = await tx.caseFile.create({
          data: {
            ...data,
            openedAt: new Date(data.openedAt),
            deadlineAt: new Date(data.deadlineAt),
            createdById: actor.id,
            episodes: { create: episodes.map((e) => ({ ...e, dateTime: new Date(e.dateTime) })) },
          },
          include: fileInclude,
        });
        await audit(tx, actor, 'CREATED', row.id, { episodes: episodes.length });
        return this.preview(actor, row);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException('Ish raqami allaqachon mavjud.');
      throw e;
    }
  }
  async addPerson(actor: CaseActor, id: string, input: PersonCreate) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Faqat administrator shaxs qo‘shadi.');
    if (new Date(input.birthDate) > new Date())
      throw new BadRequestException('Tug‘ilgan sana kelajakda bo‘lmasin.');
    return this.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      if (file.status !== 'NEW')
        throw new ConflictException('Shaxslar ish biriktirilishidan oldin kiritiladi.');
      const person = await tx.person.create({
        data: {
          fullName: input.fullName,
          birthDate: new Date(input.birthDate),
          gender: input.gender,
          addressEncrypted: this.crypto.encrypt(input.address),
          pinflEncrypted: input.pinfl ? this.crypto.encrypt(input.pinfl) : null,
          pinflLast4: input.pinfl?.slice(-4) ?? null,
          photoUrl: input.photoUrl,
        },
      });
      await tx.casePerson.create({ data: { caseId: id, personId: person.id, role: input.role } });
      await audit(tx, actor, 'PERSON_CREATED', id, { personId: person.id });
      return { id: person.id };
    });
  }
  async reassign(actor: CaseActor, id: string, userId: string, reason: string) {
    await this.expire(id);
    return this.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      if (actor.role !== 'HEAD' || actor.departmentId !== file.departmentId)
        throw new ForbiddenException('Faqat bo‘linma rahbari qayta biriktiradi.');
      if (['CLOSED', 'SUSPENDED'].includes(file.status))
        throw new ConflictException('Yopilgan yoki to‘xtatilgan ishni biriktirib bo‘lmaydi.');
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'USER' || user.departmentId !== file.departmentId || user.bannedAt)
        throw new BadRequestException('Faol bo‘linma tergovchisini tanlang.');
      await tx.caseFile.update({
        where: { id },
        data: {
          assignedTergovchiId: userId,
          status: file._count.scores > 0 ? 'SCORED' : 'ASSIGNED',
        },
      });
      await tx.caseLock.deleteMany({ where: { caseId: id } });
      await audit(tx, actor, 'REASSIGNED', id, {
        from: file.assignedTergovchiId,
        to: userId,
        reason,
      });
      return this.preview(actor, await lockedFile(tx, id));
    });
  }
  async approve(actor: CaseActor, id: string) {
    await this.expire(id);
    return this.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      if (actor.role !== 'HEAD' || actor.departmentId !== file.departmentId)
        throw new ForbiddenException('Faqat bo‘linma rahbari tasdiqlaydi.');
      if (file.status !== 'SCORED')
        throw new ConflictException('Avval kvalifikatsiya baholanishi kerak.');
      await tx.caseFile.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
      await tx.caseLock.deleteMany({ where: { caseId: id } });
      await audit(tx, actor, 'CLOSED', id);
      return this.preview(actor, await lockedFile(tx, id));
    });
  }
  async suspend(actor: CaseActor, id: string, reason: string) {
    return this.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      if (actor.role !== 'HEAD' || actor.departmentId !== file.departmentId)
        throw new ForbiddenException('Faqat bo‘linma rahbari qaror chiqaradi.');
      if (['CLOSED', 'SUSPENDED'].includes(file.status))
        throw new ConflictException('Ish holati mos emas.');
      await tx.caseFile.update({
        where: { id },
        data: { status: 'SUSPENDED', suspendedFrom: file.status, suspendedReason: reason },
      });
      await tx.caseLock.deleteMany({ where: { caseId: id } });
      await audit(tx, actor, 'SUSPENDED', id, { reason });
      return this.preview(actor, await lockedFile(tx, id));
    });
  }
  async resume(actor: CaseActor, id: string, deadlineAt: string, reason: string) {
    return this.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      if (actor.role !== 'HEAD' || actor.departmentId !== file.departmentId)
        throw new ForbiddenException('Faqat bo‘linma rahbari muddat belgilaydi.');
      if (file.status !== 'SUSPENDED' || new Date(deadlineAt) <= new Date())
        throw new BadRequestException('To‘xtatilgan ish va kelajak muddatini tanlang.');
      const status: CaseFileStatus =
        file.suspendedFrom ?? (file.assignedTergovchiId ? 'ASSIGNED' : 'NEW');
      await tx.caseFile.update({
        where: { id },
        data: {
          status,
          deadlineAt: new Date(deadlineAt),
          suspendedFrom: null,
          suspendedReason: null,
        },
      });
      await audit(tx, actor, 'RESUMED', id, { reason, deadlineAt });
      return this.preview(actor, await lockedFile(tx, id));
    });
  }
  async users(actor: CaseActor, page: number) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Faqat administrator.');
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({ orderBy: { createdAt: 'asc' }, skip: (page - 1) * 25, take: 25 }),
      this.db.user.count(),
    ]);
    await audit(this.db, actor, 'USERS_READ', null, { page });
    return adminUsersSchema.parse({
      items: items.map((u) => ({
        ...publicUser(u),
        departmentId: u.departmentId,
        bannedAt: u.bannedAt?.toISOString() ?? null,
      })),
      total,
    });
  }
  async updateUser(
    actor: CaseActor,
    id: string,
    input: { role: UserRole; departmentId: string; banned: boolean },
  ) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Faqat administrator.');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(71239844)`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('Foydalanuvchi topilmadi.');
      if (id === actor.id && (input.role !== 'ADMIN' || input.banned))
        throw new ConflictException('O‘z administrator huquqingizni olib tashlay olmaysiz.');
      if (
        user.role === 'ADMIN' &&
        !user.bannedAt &&
        (input.role !== 'ADMIN' || input.banned) &&
        (await tx.user.count({ where: { role: 'ADMIN', bannedAt: null } })) <= 1
      )
        throw new ConflictException('Oxirgi administrator saqlanishi kerak.');
      if (!(await tx.department.findUnique({ where: { id: input.departmentId } })))
        throw new BadRequestException('Bo‘linma topilmadi.');
      await tx.user.update({
        where: { id },
        data: {
          role: input.role,
          departmentId: input.departmentId,
          bannedAt: input.banned ? new Date() : null,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await audit(tx, actor, 'USER_UPDATED', null, {
        userId: id,
        role: input.role,
        departmentId: input.departmentId,
        banned: input.banned,
      });
      return { updated: true };
    });
  }
  async audits(actor: CaseActor, page: number) {
    if (!['ADMIN', 'AUDITOR'].includes(actor.role))
      throw new ForbiddenException('Audit faqat administrator va auditor uchun.');
    await audit(this.db, actor, 'AUDIT_READ', null, { page });
    const where = { action: { startsWith: 'LEGAL_' } };
    const [items, total] = await this.db.$transaction([
      this.db.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        skip: (page - 1) * 50,
      }),
      this.db.auditLog.count({ where }),
    ]);
    return auditListSchema.parse({
      items: items.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      total,
    });
  }
}
