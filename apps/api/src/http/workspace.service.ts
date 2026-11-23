import { mediaUrl } from './media.service';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';
import {
  getRankProgress,
  safeProfileSchema,
  safeCasesSchema,
  resolveCasePoints,
  workspaceSchema,
} from '@detective/shared';
import { Database, publicUser } from './database';

const dayKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

@Injectable()
export class WorkspaceService {
  constructor(@Inject(Database) private readonly db: Database) {}

  async profile(userId: string) {
    const [user, ranks] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId } }),
      this.db.rankConfig.findMany({
        orderBy: { displayOrder: 'asc' },
        select: { name: true, title: true, minPoints: true, displayOrder: true },
      }),
    ]);
    const { current, ...progress } = getRankProgress(user.points, ranks);
    return safeProfileSchema.parse({ ...publicUser(user), rank: current, progress });
  }
  async profileCases(userId: string) {
    const cases = await this.db.case.findMany({
      where: { publication: 'PUBLISHED' },
      take: 100,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        coverAssetKey: true,
        createdAt: true,
        difficulty: true,
        progress: {
          where: { userId },
          select: {
            caseId: true,
            status: true,
            awardedPoints: true,
            openedAt: true,
            closedAt: true,
          },
        },
      },
    });
    const entries = cases.map(({ coverAssetKey, ...entry }) => ({
      ...entry,
      coverImageUrl: mediaUrl(coverAssetKey),
      createdAt: entry.createdAt.toISOString(),
      progress: entry.progress[0]
        ? {
            ...entry.progress[0],
            openedAt: entry.progress[0].openedAt.toISOString(),
            closedAt: entry.progress[0].closedAt?.toISOString() ?? null,
          }
        : null,
    }));
    return safeCasesSchema.parse({
      opened: entries.filter((entry) => entry.progress !== null),
      unopened: entries.filter((entry) => entry.progress === null),
    });
  }
  async state(userId: string) {
    const [user, ranks, cases, activity, leaderboard, transactions] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId } }),
      this.db.rankConfig.findMany({
        orderBy: { displayOrder: 'asc' },
        select: { name: true, title: true, minPoints: true, displayOrder: true },
      }),
      this.db.case.findMany({
        where: { publication: 'PUBLISHED' },
        take: 100,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          evidence: { orderBy: { displayOrder: 'asc' } },
          progress: { where: { userId } },
        },
      }),
      this.db.auditLog.findMany({
        where: {
          actorId: userId,
          action: { in: ['AUTH_REGISTER', 'CASE_OPEN', 'CASE_CLOSED', 'CASE_CREATED'] },
        },
        take: 12,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.user.findMany({
        where: { bannedAt: null, role: 'USER' },
        take: 5,
        orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, displayName: true, points: true, rankName: true, avatarKey: true },
      }),
      this.db.pointTransaction.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        select: { amount: true, createdAt: true },
      }),
    ]);
    const weekly = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.now() - (6 - index) * 86400000);
      const entries = transactions.filter((entry) => dayKey(entry.createdAt) === dayKey(date));
      return {
        day: dayKey(date),
        points: entries.reduce((sum, entry) => sum + entry.amount, 0),
        opened: entries.length,
      };
    });
    return workspaceSchema.parse({
      user: publicUser(user),
      ranks,
      weekly,
      cases: cases.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        summary: entry.summary,
        description: entry.description,
        difficulty: entry.difficulty,
        basePoints: entry.basePoints,
        customPoints: entry.customPoints,
        publication: entry.publication,
        coverAssetKey: entry.coverAssetKey,
        coverImageUrl: mediaUrl(entry.coverAssetKey),
        createdAt: entry.createdAt.toISOString(),
        evidence: entry.evidence.map(({ id, title, type, content, assetKey }) => ({
          id,
          title,
          type,
          content: entry.progress.length ? content : null,
          assetKey: entry.progress.length ? assetKey : null,
        })),
        progress: entry.progress[0]
          ? {
              caseId: entry.id,
              status: entry.progress[0].status,
              awardedPoints: entry.progress[0].awardedPoints,
              openedAt: entry.progress[0].openedAt.toISOString(),
              closedAt: entry.progress[0].closedAt?.toISOString() ?? null,
            }
          : null,
      })),
      activity: activity.map((entry) => ({
        id: entry.id,
        action: entry.action,
        createdAt: entry.createdAt.toISOString(),
        title:
          typeof entry.metadata === 'object' &&
          entry.metadata !== null &&
          !Array.isArray(entry.metadata) &&
          typeof entry.metadata['title'] === 'string'
            ? entry.metadata['title']
            : null,
      })),
      leaderboard: leaderboard.map(({ avatarKey, ...entry }) => ({
        ...entry,
        avatarUrl: mediaUrl(avatarKey),
      })),
    });
  }

  async open(userId: string, caseId: string, key: string, requestId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(72413001)`;
            await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
            const [user, entry, existing] = await Promise.all([
              tx.user.findUniqueOrThrow({ where: { id: userId } }),
              tx.case.findUnique({ where: { id: caseId } }),
              tx.userCaseProgress.findUnique({ where: { userId_caseId: { userId, caseId } } }),
            ]);
            if (!entry || entry.publication !== 'PUBLISHED')
              throw new NotFoundException('Ish topilmadi.');
            if (existing) return { awarded: false, pointsAdded: 0, rankChanged: false };
            const reused = await tx.pointTransaction.findUnique({
              where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
            });
            if (reused) throw new ConflictException('So‘rov kaliti boshqa ish uchun ishlatilgan.');
            const points = resolveCasePoints(entry.difficulty, entry.customPoints);
            if (user.points + points > 2147483647)
              throw new BadRequestException('Ball chegarasiga yetildi.');
            await tx.userCaseProgress.create({ data: { userId, caseId, awardedPoints: points } });
            const updated = await tx.user.update({
              where: { id: userId },
              data: { points: { increment: points } },
            });
            await tx.pointTransaction.create({
              data: {
                userId,
                caseId,
                type: 'CASE_OPEN',
                amount: points,
                balanceAfter: updated.points,
                idempotencyKey: key,
                reason: `Ish ochildi: ${entry.title}`,
                requestId,
              },
            });
            await tx.auditLog.create({
              data: {
                actorId: userId,
                action: 'CASE_OPEN',
                targetType: 'CASE',
                targetId: caseId,
                requestId,
                metadata: { title: entry.title, points },
              },
            });
            return {
              awarded: true,
              pointsAdded: points,
              rankChanged: updated.rankName !== user.rankName,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' ||
            (error.code === 'P2010' &&
              ['40001', '40P01'].includes(String(error.meta?.['code'])))) &&
          attempt < 2
        ) {
          await delay(50 * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('So‘rovni qayta urinib ko‘ring.');
  }

  async close(userId: string, caseId: string, requestId: string) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.userCaseProgress.findUnique({
        where: { userId_caseId: { userId, caseId } },
      });
      if (!current) throw new BadRequestException('Avval ishni boshlang.');
      if (current.status === 'CLOSED') return { closed: true };
      const updated = await tx.userCaseProgress.updateMany({
        where: { id: current.id, status: 'IN_PROGRESS' },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      if (updated.count) {
        const entry = await tx.case.findUniqueOrThrow({ where: { id: caseId } });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'CASE_CLOSED',
            targetType: 'CASE',
            targetId: caseId,
            requestId,
            metadata: { title: entry.title },
          },
        });
      }
      return { closed: true };
    });
  }
}
