import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  publicUserSchema,
  successEnvelope,
  workspaceSchema,
  caseActionResultSchema,
  safeProfileSchema,
  safeCasesSchema,
  passwordChangedSchema,
} from '@detective/shared';
import { createApi } from '../src/http/application';
import { Database } from '../src/http/database';
import { seedDatabase } from '../src/infra/seed';
import { seedEnvironmentSchema } from '../src/infra/seed-config';

const testUrl = process.env['TEST_DATABASE_URL'];
if (
  !testUrl ||
  !new URL(testUrl).pathname.endsWith('_test') ||
  !new URL(testUrl).searchParams.get('schema')?.startsWith('phase0_')
) {
  throw new Error('HTTP sinovini faqat pnpm test:http orqali ishga tushiring.');
}
let app: NestFastifyApplication;
let server: FastifyInstance;
let db: Database;
let caseId = '';
let mediaDirectory = '';
const mediaBase = resolve('../../.cache');
const password = 'HTTP test passphrase 2026';
const authBody = () => ({
  email: `http-${randomUUID()}@example.test`,
  displayName: 'Sinov tergovchisi',
  password,
});
function cookieHeader(raw: string | string[] | undefined) {
  return (Array.isArray(raw) ? raw : [raw ?? '']).map((value) => value.split(';')[0]).join('; ');
}
async function account() {
  const body = authBody();
  const response = await server.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: body,
  });
  expect(response.statusCode).toBe(201);
  const user = successEnvelope(publicUserSchema).parse(response.json()).data;
  return { ...body, user, cookies: cookieHeader(response.headers['set-cookie']) };
}
function multipartImage(image: Buffer, data?: unknown, mime = 'image/png') {
  const boundary = `http-${randomUUID()}`;
  const fields =
    data === undefined
      ? []
      : [
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(data)}\r\n`,
          ),
        ];
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      ...fields,
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="../../unsafe.png"\r\nContent-Type: ${mime}\r\n\r\n`,
      ),
      image,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}
const testPicture = () =>
  sharp({ create: { width: 256, height: 192, channels: 3, background: '#78532f' } })
    .png()
    .toBuffer();
beforeAll(async () => {
  await mkdir(mediaBase, { recursive: true });
  mediaDirectory = await mkdtemp(join(mediaBase, 'http-media-'));
  app = await createApi({
    mediaDirectory,
    secret: 'test-only-secret-with-32-characters',
    workspaceId: 'http-tests',
    controlToken: 'test-control',
    shutdown: () => undefined,
  });
  server = app.getHttpAdapter().getInstance() as FastifyInstance;
  db = app.get(Database);
  await seedDatabase(
    db,
    seedEnvironmentSchema.parse({
      DATABASE_URL: testUrl,
      SEED_ADMIN_EMAIL: 'http-admin@example.test',
      SEED_ADMIN_PASSWORD: password,
    }),
  );
  caseId = (await db.case.findUniqueOrThrow({ where: { slug: 'songgi-maktub' } })).id;
});
afterAll(async () => {
  await app?.close();
  if (!resolve(mediaDirectory).startsWith(mediaBase + sep))
    throw new Error('Unsafe media cleanup path');
  await rm(mediaDirectory, { recursive: true, force: true });
});

describe('Haqiqiy HTTP va PostgreSQL', () => {
  it('anonim so‘rovni rad etadi, sog‘liq javobini o‘raydi', async () => {
    const health = await server.inject('/api/health');
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      success: true,
      data: { workspaceId: 'http-tests', status: 'ok' },
    });
    const response = await server.inject('/api/workspace');
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ success: false, requestId: expect.any(String) });
  });
  it('USER yaratadi, parolni yashiradi va HttpOnly cookie beradi', async () => {
    const body = authBody();
    const response = await server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: body,
    });
    expect(response.statusCode).toBe(201);
    const user = successEnvelope(publicUserSchema).parse(response.json()).data;
    expect(user.role).toBe('USER');
    expect(user.points).toBe(0);
    expect(response.body).not.toContain('password');
    const cookies = response.headers['set-cookie'];
    expect(cookies).toHaveLength(2);
    for (const cookie of Array.isArray(cookies) ? cookies : []) {
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
    }
    expect(
      (await server.inject({ method: 'POST', url: '/api/auth/register', payload: body }))
        .statusCode,
    ).toBe(409);
  });
  it('rol va ballni mijozdan qabul qilmaydi, begona originni to‘sadi', async () => {
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/auth/register',
          payload: { ...authBody(), role: 'ADMIN', points: 999 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: { origin: 'https://foreign.example' },
          payload: authBody(),
        })
      ).statusCode,
    ).toBe(403);
  });
  it('login parolini tekshiradi va profil o‘zgarishini saqlaydi', async () => {
    const user = await account();
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: user.email, password: 'wrong password 2026' },
        })
      ).statusCode,
    ).toBe(401);
    const login = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password },
    });
    expect(login.statusCode).toBe(201);
    const cookies = cookieHeader(login.headers['set-cookie']);
    const updated = await server.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: { cookie: cookies },
      payload: { displayName: 'Yangi ism' },
    });
    expect(successEnvelope(publicUserSchema).parse(updated.json()).data.displayName).toBe(
      'Yangi ism',
    );
    expect(
      (
        await server.inject({
          method: 'PATCH',
          url: '/api/users/me',
          headers: { cookie: cookies },
          payload: { displayName: 'Admin', role: 'ADMIN' },
        })
      ).statusCode,
    ).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.user.id } })).displayName).toBe(
      'Yangi ism',
    );
  });
  it('workspace haqiqiy unvon, ish, 18 dalil va haftalik natijani qaytaradi', async () => {
    const user = await account();
    const response = await server.inject({
      url: '/api/workspace',
      headers: { cookie: user.cookies },
    });
    expect(response.statusCode).toBe(200);
    const state = successEnvelope(workspaceSchema).parse(response.json()).data;
    expect(state.ranks).toHaveLength(10);
    expect(state.cases).toHaveLength(6);
    expect(state.cases.flatMap((entry) => entry.evidence)).toHaveLength(18);
    expect(
      state.cases
        .flatMap((entry) => entry.evidence)
        .every((entry) => entry.content === null && entry.assetKey === null),
    ).toBe(true);
    expect(state.weekly).toHaveLength(7);
    expect(state.user.id).toBe(user.user.id);
  });
  it('parallel ochishda bir marta ball yozadi va ishni bir marta yakunlaydi', async () => {
    const user = await account();
    const open = () =>
      server.inject({
        method: 'POST',
        url: `/api/cases/${caseId}/open`,
        headers: { cookie: user.cookies, 'idempotency-key': randomUUID() },
      });
    const responses = await Promise.all([open(), open(), open()]);
    const results = responses.map((response) => {
      expect(response.statusCode).toBe(201);
      return successEnvelope(caseActionResultSchema).parse(response.json()).data;
    });
    expect(results.filter((entry) => entry.awarded)).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.user.id } })).points).toBe(20);
    expect(await db.pointTransaction.count({ where: { userId: user.user.id } })).toBe(1);
    const state = successEnvelope(workspaceSchema).parse(
      (await server.inject({ url: '/api/workspace', headers: { cookie: user.cookies } })).json(),
    ).data;
    expect(
      state.cases.find((entry) => entry.id === caseId)?.evidence.every((entry) => !!entry.content),
    ).toBe(true);
    const close = () =>
      server.inject({
        method: 'POST',
        url: `/api/cases/${caseId}/close`,
        headers: { cookie: user.cookies },
      });
    expect(
      successEnvelope(z.object({ closed: z.boolean() })).parse((await close()).json()).data.closed,
    ).toBe(true);
    expect(
      successEnvelope(z.object({ closed: z.boolean() })).parse((await close()).json()).data.closed,
    ).toBe(true);
    expect(
      await db.auditLog.count({
        where: { actorId: user.user.id, action: 'CASE_CLOSED', targetId: caseId },
      }),
    ).toBe(1);
    expect(
      (
        await db.userCaseProgress.findUniqueOrThrow({
          where: { userId_caseId: { userId: user.user.id, caseId } },
        })
      ).closedAt,
    ).not.toBeNull();
  });
  it('refreshni aylantiradi va qayta ishlatilgan token oilasini bekor qiladi', async () => {
    const user = await account();
    const refresh = await server.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: user.cookies },
    });
    expect(refresh.statusCode).toBe(201);
    const next = cookieHeader(refresh.headers['set-cookie']);
    expect(
      (await server.inject({ url: '/api/auth/me', headers: { cookie: next } })).statusCode,
    ).toBe(200);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/auth/refresh',
          headers: { cookie: user.cookies },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (await server.inject({ url: '/api/auth/me', headers: { cookie: next } })).statusCode,
    ).toBe(401);
  });
  it('logout eski access tokenni ham bekor qiladi', async () => {
    const user = await account();
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/auth/logout',
          headers: { cookie: user.cookies },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (await server.inject({ url: '/api/auth/me', headers: { cookie: user.cookies } })).statusCode,
    ).toBe(401);
  });
  it('ADMIN yaratadi, oddiy USERga admin amallarini taqiqlaydi', async () => {
    const user = await account();
    const payload = {
      title: 'HTTP sinov ishi',
      summary: 'Faqat ajratilgan sinov sxemasiga yoziladi.',
      description: 'Sinov uchun yaratilgan tergov materiali.',
      difficulty: 'EASY',
      customPoints: null,
    };
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/admin/cases',
          headers: { cookie: user.cookies },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    const login = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'http-admin@example.test', password },
    });
    const adminCookie = cookieHeader(login.headers['set-cookie']);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/admin/cases',
          headers: { cookie: adminCookie },
          payload,
        })
      ).statusCode,
    ).toBe(400);
    const uploaded = multipartImage(await testPicture(), payload);
    const created = await server.inject({
      method: 'POST',
      url: '/api/admin/cases',
      headers: { cookie: adminCookie, ...uploaded.headers },
      payload: uploaded.payload,
    });
    expect(created.statusCode).toBe(201);
    const id = successEnvelope(z.object({ id: z.uuid() })).parse(created.json()).data.id;
    const stored = await db.case.findUniqueOrThrow({ where: { id } });
    expect(stored.publication).toBe('PUBLISHED');
    expect(stored.coverAssetKey).toMatch(/^cases\//);
    const photo = await server.inject({
      url: '/api/media/' + stored.coverAssetKey,
      headers: { cookie: adminCookie },
    });
    expect(photo.statusCode).toBe(200);
    expect(photo.headers['content-type']).toContain('image/webp');
  });
});

describe('Rasm yuklash va media himoyasi', () => {
  it('avatarni saqlaydi, qayta o‘qiydi va almashtirishni DBda aks ettiradi', async () => {
    const user = await account();
    const image = multipartImage(await testPicture());
    const response = await server.inject({
      method: 'POST',
      url: '/api/users/me/avatar',
      headers: { cookie: user.cookies, ...image.headers },
      payload: image.payload,
    });
    expect(response.statusCode).toBe(201);
    const updated = successEnvelope(publicUserSchema).parse(response.json()).data;
    expect(updated.avatarUrl).toMatch(new RegExp(`/avatars/${user.user.id}/[a-f0-9-]+\\.webp$`));
    const read = await server.inject({
      url: updated.avatarUrl ?? '',
      headers: { cookie: user.cookies },
    });
    expect(read.statusCode).toBe(200);
    expect((await sharp(read.rawPayload).metadata()).format).toBe('webp');
    expect((await sharp(read.rawPayload).metadata()).width).toBe(512);
    const me = successEnvelope(publicUserSchema).parse(
      (await server.inject({ url: '/api/auth/me', headers: { cookie: user.cookies } })).json(),
    ).data;
    expect(me.avatarUrl).toBe(updated.avatarUrl);
    const next = await server.inject({
      method: 'POST',
      url: '/api/users/me/avatar',
      headers: { cookie: user.cookies, ...image.headers },
      payload: image.payload,
    });
    expect(next.statusCode).toBe(201);
    expect(successEnvelope(publicUserSchema).parse(next.json()).data.avatarUrl).not.toBe(
      updated.avatarUrl,
    );
    expect(
      (await server.inject({ url: updated.avatarUrl ?? '', headers: { cookie: user.cookies } }))
        .statusCode,
    ).toBe(403);
  });
  it('SVG, buzilgan baytlar va juda kichik rasmni rad etadi', async () => {
    const user = await account();
    const invalid = [
      multipartImage(
        Buffer.from('<svg><script>alert(1)</script></svg>'),
        undefined,
        'image/svg+xml',
      ),
      multipartImage(Buffer.from('not a png')),
      multipartImage((await testPicture()).subarray(0, 80)),
      multipartImage(
        await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
          .png()
          .toBuffer(),
      ),
    ];
    for (const image of invalid)
      expect(
        (
          await server.inject({
            method: 'POST',
            url: '/api/users/me/avatar',
            headers: { cookie: user.cookies, ...image.headers },
            payload: image.payload,
          })
        ).statusCode,
      ).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.user.id } })).avatarKey).toBeNull();
  });
  it('4 MB dan katta faylni 413 bilan rad etadi', async () => {
    const user = await account();
    const image = multipartImage(Buffer.alloc(4 * 1024 * 1024 + 1));
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/users/me/avatar',
          headers: { cookie: user.cookies, ...image.headers },
          payload: image.payload,
        })
      ).statusCode,
    ).toBe(413);
  });
  it('hajmi kichik bo‘lsa ham piksel chegarasidan katta rasmni rad etadi', async () => {
    const user = await account();
    const image = multipartImage(
      await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#fff' } })
        .png()
        .toBuffer(),
    );
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/users/me/avatar',
          headers: { cookie: user.cookies, ...image.headers },
          payload: image.payload,
        })
      ).statusCode,
    ).toBe(400);
  });
  it('anonim yuklash va taxminiy media yo‘lini rad etadi', async () => {
    const user = await account();
    const image = multipartImage(await testPicture());
    expect(
      (await server.inject({ method: 'POST', url: '/api/users/me/avatar', ...image })).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          url: `/api/media/avatars/${user.user.id}/${randomUUID()}.webp`,
          headers: { cookie: user.cookies },
        })
      ).statusCode,
    ).toBe(403);
  });
});

describe('Metall seyf profili va parol', () => {
  const replacement = 'New private passphrase 2026';
  it('profil va faqat joriy foydalanuvchi ochgan ishlarni ajratib qaytaradi', async () => {
    const user = await account();
    expect((await server.inject({ url: '/api/users/me' })).statusCode).toBe(401);
    const profile = successEnvelope(safeProfileSchema).parse(
      (await server.inject({ url: '/api/users/me', headers: { cookie: user.cookies } })).json(),
    ).data;
    expect(profile.displayName).toBe(user.displayName);
    expect(profile.rank.title).toBe('Leytenant');
    expect(profile.points).toBe(0);
    expect(profile.progress.remaining).toBe(150);
    const initial = successEnvelope(safeCasesSchema).parse(
      (
        await server.inject({ url: '/api/users/me/cases', headers: { cookie: user.cookies } })
      ).json(),
    ).data;
    expect(initial.opened).toHaveLength(0);
    expect(initial.unopened.every((entry) => entry.slug.length > 0)).toBe(true);
    expect(
      initial.unopened.find((entry) => entry.title === 'HTTP sinov ishi')?.coverImageUrl,
    ).toMatch(/^\/api\/media\/cases\//);

    expect(initial.unopened).toHaveLength(
      await db.case.count({ where: { publication: 'PUBLISHED' } }),
    );
    await server.inject({
      method: 'POST',
      url: `/api/cases/${caseId}/open`,
      headers: { cookie: user.cookies, 'idempotency-key': randomUUID() },
    });
    const opened = successEnvelope(safeCasesSchema).parse(
      (
        await server.inject({ url: '/api/users/me/cases', headers: { cookie: user.cookies } })
      ).json(),
    ).data;
    expect(opened.opened.map((entry) => entry.id)).toEqual([caseId]);
    expect(opened.unopened).toHaveLength(initial.unopened.length - 1);
    expect(opened.opened[0]).not.toHaveProperty('evidence');
    const updated = successEnvelope(safeProfileSchema).parse(
      (await server.inject({ url: '/api/users/me', headers: { cookie: user.cookies } })).json(),
    ).data;
    expect(updated.points).toBe(20);
    expect(updated.progress.remaining).toBe(130);
  });
  it('xato eski parol, qisqa, bir xil va 72 baytdan uzun yangi parolni rad etadi', async () => {
    const user = await account();
    const previous = (await db.user.findUniqueOrThrow({ where: { id: user.user.id } }))
      .passwordHash;
    for (const payload of [
      { oldPassword: 'wrong password', newPassword: replacement },
      { oldPassword: password, newPassword: 'short' },
      { oldPassword: password, newPassword: password },
      { oldPassword: password, newPassword: 'é'.repeat(40) },
    ]) {
      expect(
        (
          await server.inject({
            method: 'PATCH',
            url: '/api/users/me/password',
            headers: { cookie: user.cookies },
            payload,
          })
        ).statusCode,
      ).toBe(400);
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: user.user.id } })).passwordHash).toBe(
      previous,
    );
    expect(
      (await server.inject({ url: '/api/auth/me', headers: { cookie: user.cookies } })).statusCode,
    ).toBe(200);
  });
  it('bcrypt saqlaydi, barcha sessiyalarni yopadi va yangi parol bilan kirishga ruxsat beradi', async () => {
    const user = await account();
    const second = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password },
    });
    const secondCookies = cookieHeader(second.headers['set-cookie']);
    const changed = await server.inject({
      method: 'PATCH',
      url: '/api/users/me/password',
      headers: { cookie: user.cookies },
      payload: { oldPassword: password, newPassword: replacement },
    });
    expect(changed.statusCode).toBe(200);
    expect(successEnvelope(passwordChangedSchema).parse(changed.json()).data.changed).toBe(true);
    expect(String(changed.headers['set-cookie'])).toContain('tergov_access=;');
    expect(String(changed.headers['set-cookie'])).toContain('tergov_refresh=;');
    const stored = (await db.user.findUniqueOrThrow({ where: { id: user.user.id } })).passwordHash;
    expect(stored).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare(replacement, stored)).toBe(true);
    expect(await db.refreshToken.count({ where: { userId: user.user.id, revokedAt: null } })).toBe(
      0,
    );
    for (const cookie of [user.cookies, secondCookies])
      expect((await server.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(
        401,
      );
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/auth/refresh',
          headers: { cookie: secondCookies },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: user.email, password },
        })
      ).statusCode,
    ).toBe(401);
    const login = await server.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: replacement },
    });
    expect(login.statusCode).toBe(201);
    const cookies = cookieHeader(login.headers['set-cookie']);
    const again = await server.inject({
      method: 'PATCH',
      url: '/api/users/me/password',
      headers: { cookie: cookies },
      payload: { oldPassword: replacement, newPassword: 'Another private passphrase 2026' },
    });
    expect(again.statusCode).toBe(200);
    expect(
      await db.auditLog.count({ where: { actorId: user.user.id, action: 'PASSWORD_CHANGED' } }),
    ).toBe(2);
    const audit = await db.auditLog.findFirstOrThrow({
      where: { actorId: user.user.id, action: 'PASSWORD_CHANGED' },
    });
    expect(JSON.stringify(audit)).not.toContain(replacement);
  });
  it('bir vaqtdagi ikki almashtirishdan faqat bittasini qabul qiladi', async () => {
    const user = await account();
    const changes = await Promise.all(
      ['First new passphrase 2026', 'Second new passphrase 2026'].map((newPassword) =>
        server.inject({
          method: 'PATCH',
          url: '/api/users/me/password',
          headers: { cookie: user.cookies },
          payload: { oldPassword: password, newPassword },
        }),
      ),
    );
    expect(changes.map((entry) => entry.statusCode).sort()).toEqual([200, 409]);
    expect(
      await db.auditLog.count({ where: { actorId: user.user.id, action: 'PASSWORD_CHANGED' } }),
    ).toBe(1);
  });
  it('anonim foydalanuvchiga parol almashtirishni taqiqlaydi', async () => {
    expect(
      (
        await server.inject({
          method: 'PATCH',
          url: '/api/users/me/password',
          payload: { oldPassword: password, newPassword: replacement },
        })
      ).statusCode,
    ).toBe(401);
  });
});
