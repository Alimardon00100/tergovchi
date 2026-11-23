import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANKS,
  SEED_CASES,
  caseProgressSchema,
  caseWriteSchema,
  getRankProgress,
  paginationSchema,
  pointsSchema,
  publicUserSchema,
  rankConfigurationSchema,
  registerSchema,
  resolveCasePoints,
  resolveRank,
} from '../src';

describe('Unvon chegaralari', () => {
  it.each(DEFAULT_RANKS)('$minPoints ball → $name', (rank) => {
    expect(resolveRank(rank.minPoints).name).toBe(rank.name);
  });
  it.each(DEFAULT_RANKS.slice(1))('$name chegarasigacha oldingi unvon saqlanadi', (rank) => {
    expect(resolveRank(rank.minPoints - 1).displayOrder).toBe(rank.displayOrder - 1);
  });
  it('bir nechta unvonni birdan sakrab o‘tadi', () => {
    expect(resolveRank(7000).name).toBe('COLONEL_GENERAL');
  });
  it('marshal uchun progress cheksizlik yoki NaN qaytarmaydi', () => {
    expect(getRankProgress(12000)).toMatchObject({ next: null, remaining: 0, percent: 100 });
    expect(getRankProgress(2_147_483_647).current.name).toBe('MARSHAL');
  });
  it('oraliq progressni joriy unvondan hisoblaydi', () => {
    expect(getRankProgress(250)).toMatchObject({ remaining: 100, percent: 50 });
  });
  it('kiruvchi massivni mutatsiya qilmaydi va uning tartibiga ishonmaydi', () => {
    const configuration = [...DEFAULT_RANKS].reverse();
    expect(resolveRank(350, configuration).name).toBe('CAPTAIN');
    expect(configuration[0]?.name).toBe('MARSHAL');
  });
  it.each([-1, 0.5, NaN, Infinity, 2_147_483_648])('yaroqsiz ballni rad etadi: %s', (points) => {
    expect(() => resolveRank(points)).toThrow();
  });
  it('takroriy unvon va noto‘g‘ri boshlang‘ich chegarani rad etadi', () => {
    expect(
      rankConfigurationSchema.safeParse(
        DEFAULT_RANKS.map((rank) => ({ ...rank, name: 'LIEUTENANT' })),
      ).success,
    ).toBe(false);
    expect(
      rankConfigurationSchema.safeParse(
        DEFAULT_RANKS.map((rank) => ({ ...rank, minPoints: rank.minPoints + 1 })),
      ).success,
    ).toBe(false);
  });
  it('o‘zgartirilgan unvon chegarasini qo‘llaydi', () => {
    const configuration = DEFAULT_RANKS.map((rank) =>
      rank.name === 'CAPTAIN' ? { ...rank, minPoints: 400 } : rank,
    );
    expect(resolveRank(350, configuration).name).toBe('SENIOR_LIEUTENANT');
  });
});

describe('Ball qoidalari', () => {
  it.each([
    ['EASY', 20],
    ['MEDIUM', 30],
    ['HARD', 50],
  ] as const)('%s asosiy balli %s', (difficulty, points) => {
    expect(resolveCasePoints(difficulty, null)).toBe(points);
  });
  it('nol override va ixtiyoriy musbat ballni saqlaydi', () => {
    expect(resolveCasePoints('HARD', 0)).toBe(0);
    expect(resolveCasePoints('EASY', 500)).toBe(500);
  });
  it('manfiy override va PostgreSQL integerdan katta qiymatni rad etadi', () => {
    expect(() => resolveCasePoints('EASY', -1)).toThrow();
    expect(pointsSchema.safeParse(2_147_483_648).success).toBe(false);
  });
});

describe('Kirish kontraktlari', () => {
  const valid = {
    email: '  Agent@Example.Test ',
    password: 'a long passphrase 2026',
    displayName: 'Tergovchi',
  };
  it('emailni normallashtiradi va parolni o‘zgartirmaydi', () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe('agent@example.test');
    expect(parsed.password).toBe(valid.password);
  });
  it('ro‘yxatdan o‘tishda admin rolini tashqaridan kiritishni rad etadi', () => {
    expect(registerSchema.safeParse({ ...valid, role: 'ADMIN' }).success).toBe(false);
  });
  it('qisqa parolni rad etadi', () => {
    expect(registerSchema.safeParse({ ...valid, password: '123456' }).success).toBe(false);
  });
  it('ochiq foydalanuvchi javobida parol hashiga ruxsat bermaydi', () => {
    const publicUser = {
      id: 'f1c1652d-dc20-45d9-9e72-eab3ad652877',
      email: 'agent@example.test',
      displayName: 'Tergovchi',
      role: 'USER',
      points: 0,
      rankName: 'LIEUTENANT',
      avatarUrl: null,
      createdAt: '2026-11-21T00:00:00.000Z',
    };
    expect(publicUserSchema.safeParse(publicUser).success).toBe(true);
    expect(publicUserSchema.safeParse({ ...publicUser, passwordHash: 'secret' }).success).toBe(
      false,
    );
  });
  it('sahifalashni cheklaydi', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationSchema.safeParse({ page: -1 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
  it('barcha olti seed ishini kontrakt bo‘yicha tekshiradi', () => {
    expect(SEED_CASES).toHaveLength(6);
    for (const seedCase of SEED_CASES)
      expect(caseWriteSchema.safeParse(seedCase).success).toBe(true);
    expect(new Set(SEED_CASES.map((entry) => entry.slug)).size).toBe(6);
  });
  it('papka yopilish vaqti holatiga mos bo‘lishini talab qiladi', () => {
    const base = {
      caseId: 'f1c1652d-dc20-45d9-9e72-eab3ad652877',
      status: 'IN_PROGRESS',
      awardedPoints: 20,
      openedAt: '2026-11-21T10:00:00.000Z',
      closedAt: null,
    };
    expect(caseProgressSchema.safeParse(base).success).toBe(true);
    expect(caseProgressSchema.safeParse({ ...base, status: 'CLOSED' }).success).toBe(false);
    expect(
      caseProgressSchema.safeParse({
        ...base,
        status: 'CLOSED',
        closedAt: '2026-11-21T09:00:00.000Z',
      }).success,
    ).toBe(false);
    expect(
      caseProgressSchema.safeParse({
        ...base,
        status: 'CLOSED',
        closedAt: '2026-11-21T11:00:00.000Z',
      }).success,
    ).toBe(true);
  });
  it('turli millisekund aniqligidagi vaqtlarni sana sifatida solishtiradi', () => {
    expect(
      caseProgressSchema.safeParse({
        caseId: 'f1c1652d-dc20-45d9-9e72-eab3ad652877',
        status: 'CLOSED',
        awardedPoints: 20,
        openedAt: '2026-11-21T10:00:00Z',
        closedAt: '2026-11-21T10:00:00.100Z',
      }).success,
    ).toBe(true);
  });
});
