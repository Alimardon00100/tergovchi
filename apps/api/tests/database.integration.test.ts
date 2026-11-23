import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verify } from 'argon2';
import { SEED_CASES } from '@detective/shared';
import { seedDatabase } from '../src/infra/seed';
import { seedEnvironmentSchema } from '../src/infra/seed-config';

const testUrl = process.env['TEST_DATABASE_URL'];
if (
  !testUrl ||
  !new URL(testUrl).pathname.endsWith('_test') ||
  !new URL(testUrl).searchParams.get('schema')?.startsWith('phase0_')
) {
  throw new Error('Integratsiya sinovini faqat pnpm test:db orqali ishga tushiring.');
}
const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
const environment = seedEnvironmentSchema.parse({
  DATABASE_URL: testUrl,
  SEED_ADMIN_EMAIL: 'seed-admin@example.test',
  SEED_ADMIN_PASSWORD: 'test-only passphrase 2026',
});
let adminId = '';
let caseId = '';

beforeAll(async () => {
  const seeded = await seedDatabase(prisma, environment);
  adminId = seeded.adminId;
  const firstCase = await prisma.case.findUniqueOrThrow({
    where: { slug: SEED_CASES[0]?.slug ?? '' },
  });
  caseId = firstCase.id;
});
afterAll(async () => {
  await prisma.$disconnect();
});

async function rolledBack(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  const rollback = new Error('Sinov tranzaksiyasini qaytarish');
  try {
    await prisma.$transaction(async (tx) => {
      await work(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describe('PostgreSQL invariantlari', () => {
  it('haqiqiy PostgreSQL 16 muhitida ishlaydi', async () => {
    const rows = await prisma.$queryRaw<
      { version: string }[]
    >`SELECT current_setting('server_version_num') AS version`;
    const major = Math.floor(Number(rows[0]?.version) / 10000);
    expect(major).toBe(16);
  });
  it('10 unvon, 6 ish va Argon2id admin yaratadi', async () => {
    expect(await prisma.rankConfig.count()).toBe(10);
    expect(await prisma.case.count()).toBe(6);
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect(admin.role).toBe('ADMIN');
    expect(admin.rankName).toBe('LIEUTENANT');
    expect(admin.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await verify(admin.passwordHash, environment.SEED_ADMIN_PASSWORD)).toBe(true);
  });
  it('seed qaytarilganda admin paroli va tahrirlangan ish saqlanadi', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    await prisma.case.update({ where: { id: caseId }, data: { title: 'Tahrirlangan ish' } });
    await seedDatabase(prisma, {
      ...environment,
      SEED_ADMIN_PASSWORD: 'another test passphrase 2026',
    });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: caseId } })).title).toBe(
      'Tahrirlangan ish',
    );
    expect(await prisma.case.count()).toBe(6);
  });
  it('oddiy foydalanuvchini seed orqali admin qilmaydi', async () => {
    await prisma.user.create({
      data: {
        email: 'regular@example.test',
        displayName: 'Oddiy foydalanuvchi',
        passwordHash: 'test-hash',
      },
    });
    await expect(
      seedDatabase(prisma, { ...environment, SEED_ADMIN_EMAIL: 'regular@example.test' }),
    ).rejects.toThrow('faol admin');
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: 'regular@example.test' } })).role,
    ).toBe('USER');
  });
  it('ball o‘zgarsa unvonni bazaning o‘zi moslaydi', async () => {
    await rolledBack(async (tx) => {
      const user = await tx.user.update({
        where: { id: adminId },
        data: { points: 7000, rankName: 'LIEUTENANT' },
      });
      expect(user.rankName).toBe('COLONEL_GENERAL');
    });
  });
  it('nol ballda qo‘lda marshal yozishni tuzatadi', async () => {
    await rolledBack(async (tx) => {
      expect(
        (await tx.user.update({ where: { id: adminId }, data: { points: 0, rankName: 'MARSHAL' } }))
          .rankName,
      ).toBe('LIEUTENANT');
    });
  });
  it('manfiy ballni bazada rad etadi', async () => {
    await expect(
      prisma.user.update({ where: { id: adminId }, data: { points: -1 } }),
    ).rejects.toThrow();
  });
  it('email registrini bazada normallashtiradi va takrorlanishni bloklaydi', async () => {
    await expect(
      prisma.user.create({
        data: {
          email: 'SEED-ADMIN@EXAMPLE.TEST',
          displayName: 'Takroriy',
          passwordHash: 'test-hash',
        },
      }),
    ).rejects.toThrow();
  });
  it('bir ish uchun takroriy progressni bloklaydi', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const data = { userId: adminId, caseId, awardedPoints: 20 };
        await tx.userCaseProgress.create({ data });
        await tx.userCaseProgress.create({ data });
      }),
    ).rejects.toThrow();
  });
  it('CLOSED holati uchun yopilish vaqtini talab qiladi', async () => {
    await expect(
      prisma.userCaseProgress.create({
        data: { userId: adminId, caseId, awardedPoints: 20, status: 'CLOSED' },
      }),
    ).rejects.toThrow();
  });
  it('qiyinchilik va asosiy ball nomuvofiqligini rad etadi', async () => {
    await expect(
      prisma.case.update({ where: { id: caseId }, data: { basePoints: 50 } }),
    ).rejects.toThrow();
  });
  it('nol customPoints ni saqlaydi, manfiyini rad etadi', async () => {
    await rolledBack(async (tx) => {
      expect(
        (await tx.case.update({ where: { id: caseId }, data: { customPoints: 0 } })).customPoints,
      ).toBe(0);
    });
    await expect(
      prisma.case.update({ where: { id: caseId }, data: { customPoints: -1 } }),
    ).rejects.toThrow();
  });
  it('bir ish uchun ikki xil kalit bilan ham ballni takrorlashni bloklaydi', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const data = {
          userId: adminId,
          caseId,
          type: 'CASE_OPEN' as const,
          amount: 20,
          balanceAfter: 20,
          reason: 'Ishni ochish',
          requestId: randomUUID(),
        };
        await tx.pointTransaction.create({ data: { ...data, idempotencyKey: randomUUID() } });
        await tx.pointTransaction.create({ data: { ...data, idempotencyKey: randomUUID() } });
      }),
    ).rejects.toThrow();
  });
  it('unvon chegarasi yangilansa foydalanuvchini qayta hisoblaydi', async () => {
    await rolledBack(async (tx) => {
      await tx.user.update({ where: { id: adminId }, data: { points: 350 } });
      await tx.rankConfig.update({ where: { name: 'CAPTAIN' }, data: { minPoints: 400 } });
      expect((await tx.user.findUniqueOrThrow({ where: { id: adminId } })).rankName).toBe(
        'SENIOR_LIEUTENANT',
      );
    });
  });
  it('noto‘g‘ri unvon tartibini commit vaqtida rad etadi', async () => {
    await expect(
      prisma.rankConfig.update({ where: { name: 'CAPTAIN' }, data: { minPoints: 100 } }),
    ).rejects.toThrow();
  });
});
