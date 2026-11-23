/* global document, innerWidth */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const root = process.cwd(),
  req = createRequire(join(root, 'apps/api/package.json')),
  { PrismaClient } = req('@prisma/client'),
  bcrypt = req('bcryptjs');
const db = new PrismaClient();
const runtime = JSON.parse(await readFile('.local/web.json', 'utf8')),
  base = `http://127.0.0.1:${runtime.port}`;
const output = resolve('.cache/case-module-qa');
await mkdir(output, { recursive: true });
const run = randomUUID(),
  password = 'Browser legal QA 2026 passphrase',
  users = [],
  createdFiles = [];
let caseId = '',
  personId = '';
const browser = await chromium.launch({ channel: 'chromium', headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = async (name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(output, name + '.png'), fullPage: true });
};
const login = async (role) => {
  const account = users.find((u) => u.role === role);
  assert(account);
  const response = await context.request.post(base + '/api/auth/login', {
    data: { email: account.email, password },
  });
  assert.equal(response.status(), 201);
};
const json = async (response) => {
  assert(response.ok(), await response.text());
  return (await response.json()).data;
};
const pick = async (locator, label) => {
  await locator.click();
  await page.getByRole('option', { name: label, exact: true }).click();
};
const setSelect = async (scope, label, value) =>
  pick(scope.getByRole('combobox', { name: label, exact: true }), value);
async function fillQualification(scope, person) {
  const subject = scope
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^Subyekt / }) });
  await subject.getByRole('checkbox', { name: person, exact: false }).check();
  const object = scope
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^Obyekt / }) });
  await object.getByRole('checkbox', { name: 'Mulk', exact: true }).check();
  const objective = scope
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^Obyektiv tomon / }) });
  await setSelect(objective, 'Harakat turi', 'Harakat');
  await objective.getByRole('checkbox', { name: 'Moddiy zarar', exact: true }).check();
  await setSelect(objective, 'Sababiy bog‘lanish', 'Mavjud');
  const subjective = scope
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^Subyektiv tomon / }) });
  await setSelect(subjective, 'Aybdorlik shakli', 'Qasddan');
  await setSelect(subjective, 'Qasd turi', 'To‘g‘ri qasd');
  await setSelect(subjective, 'Motiv', 'G‘araz');
  await setSelect(subjective, 'Maqsad', 'Boyish');
}
try {
  for (const role of ['ADMIN', 'USER', 'HEAD', 'AUDITOR', 'PROSECUTOR'])
    users.push(
      await db.user.create({
        data: {
          email: `qa-legal-${role.toLowerCase()}-${run}@example.test`,
          displayName: `QA ${role}`,
          role,
          passwordHash: await bcrypt.hash(password, 12),
        },
      }),
    );
  await page.goto(base + '/login');
  await page.getByLabel('Elektron pochta', { exact: true }).fill(users[0].email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Ish maydoniga kirish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tergov doskasi' })).toBeVisible();
  await page.getByRole('link', { name: /Jinoyat ishlari reyestri/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Jinoyat ishlari reyestri', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Boshqaruv', exact: true }).click();
  await page.getByRole('button', { name: 'Yangi ish yaratish', exact: true }).click();
  const form = page.locator('form.case-edit-form').first(),
    now = new Date();
  const localIso = (d) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await form
    .getByLabel('Ish raqami', { exact: true })
    .fill('9-2026-' + String(Date.now()).slice(-8));
  await form.getByLabel('Nomi', { exact: true }).fill('QA yangi jinoyat ishi ' + run.slice(0, 8));
  await form.locator('[name="articles"]').fill('169');
  await form.locator('[name="openedAt"]').fill(localIso(now));
  await form.locator('[name="deadlineAt"]').fill(localIso(new Date(now.getTime() + 7 * 86400000)));
  await form
    .locator('[name="summary"]')
    .fill('Bu avtomatik brauzer sinovi uchun yaratilgan sun’iy jinoyat ishi.');
  await form
    .locator('[name="initialFacts"]')
    .fill('Ombor buyumlari bo‘yicha sun’iy o‘quv ma’lumotlar tekshirilmoqda.');
  await form
    .locator('[name="description1"]')
    .fill('Birinchi epizodda birinchi ombordagi mulk olib chiqilgan.');
  await form.locator('[name="article1"]').fill('169');
  await form.locator('[name="location1"]').fill('Sun’iy ombor 1');
  await form.locator('[name="date1"]').fill(localIso(new Date(now.getTime() - 86400000)));
  await form.getByRole('button', { name: 'Yangi ish yaratish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Etalon javoblar', exact: true })).toBeVisible();
  const cases = await json(await context.request.get(base + '/api/v1/cases?pageSize=50'));
  caseId = cases.items.find((c) => c.title === 'QA yangi jinoyat ishi ' + run.slice(0, 8)).id;
  const person = await json(
    await context.request.post(base + `/api/v1/cases/${caseId}/persons`, {
      data: {
        fullName: 'QA Namunaviy shaxs',
        birthDate: '2001-05-15',
        gender: 'MALE',
        address: 'Sun’iy ko‘cha, Namuna shahri',
        pinfl: '00000000004321',
        role: 'SUSPECT',
        photoUrl: null,
      },
    }),
  );
  assert(person.id);
  personId = person.id;
  const pdf = await readFile(join(output, 'auditor-report.pdf'));
  await json(
    await context.request.post(base + `/api/v1/cases/${caseId}/documents`, {
      multipart: {
        data: JSON.stringify({
          title: 'QA tekshiruv protokoli',
          type: 'PROTOCOL',
          isEvidence: true,
        }),
        file: { name: 'qa-protocol.pdf', mimeType: 'application/pdf', buffer: pdf },
      },
    }),
  );
  createdFiles.push(resolve('.local/case-files', caseId));
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /QA Namunaviy shaxs/ })).toBeVisible();
  await fillQualification(page.locator('.case-module'), 'QA Namunaviy shaxs');
  await page.getByRole('button', { name: 'Saqlash', exact: true }).first().click();
  await expect(page.getByText('Amal bajarildi.', { exact: true })).toBeVisible();
  await shot('admin-reference');
  process.stdout.write('Admin case creation and reference editor passed.\n');
  await login('USER');
  await page.goto(base + '/case-files');
  const folder = page.locator('.case-file-folder').filter({ hasText: run.slice(0, 8) });
  await folder.getByRole('button', { name: 'Ko‘rish', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Dastlabki ma’lumotnoma' })).toBeVisible();
  await expect(dialog.getByText('QA tekshiruv protokoli')).toHaveCount(0);
  await expect(dialog.getByText('QA Namunaviy shaxs')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Yopish', exact: true }).click();
  await folder.getByRole('button', { name: 'Ishni olish', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Hujjatlar', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Hujjatlar', exact: true }).click();
  await page.getByRole('button', { name: 'Hujjatni ochish', exact: true }).click();
  await expect(page.locator('.case-document-viewer iframe')).toBeVisible();
  await page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /QA Namunaviy shaxs/ })).toBeEnabled();
  await fillQualification(page.locator('.case-module'), 'QA Namunaviy shaxs');
  await expect(page.getByText('Serverda saqlandi', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.locator('.case-qualification textarea').first().fill('Offline saqlangan izoh');
  await expect(
    page.getByText('Aloqa yo‘q. Qoralama shu qurilmada saqlandi.', { exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Serverda saqlandi', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true }).click();
  await expect(page.locator('.case-qualification textarea').first()).toHaveValue(
    'Offline saqlangan izoh',
  );
  await shot('qualification');
  const accessibility = await new AxeBuilder({ page })
    .include('.case-module')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await writeFile(
    join(output, 'accessibility.json'),
    JSON.stringify(accessibility.violations, null, 2),
  );
  assert.equal(
    accessibility.violations.length,
    0,
    JSON.stringify(
      accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ),
  );
  await page.getByRole('button', { name: 'Tekshirish', exact: true }).click();
  await expect(page.locator('.case-best-score strong')).toContainText('100');
  await shot('results');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Hisobot PDF', exact: true }).click();
  await (await download).saveAs(join(output, 'browser-report.pdf'));
  await page.getByRole('combobox', { name: 'Til', exact: true }).click();
  await page.getByRole('option', { name: 'Русский', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Реестр уголовных дел', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Оформление:/ }).click();
  await expect(page.locator('.case-module').first()).toHaveClass(/theme-dark/);
  await shot('russian-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot('mobile-russian');
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'No horizontal page overflow on mobile',
  );
  await page.getByRole('combobox', { name: 'Язык', exact: true }).click();
  await page.getByRole('option', { name: 'Ўзбекча', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Жиноят ишлари реестри', exact: true }),
  ).toBeVisible();
  await shot('mobile-cyrillic');
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'O‘zbekcha', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login('HEAD');
  await page.goto(base + '/case-files/' + caseId);
  await page.getByRole('button', { name: 'Yopishni tasdiqlash', exact: true }).click();
  await expect(page.locator('.case-workspace-heading .case-stamp')).toHaveText('Yopilgan');
  await login('AUDITOR');
  await page.goto(base + '/case-files/' + caseId);
  await expect(page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Ishtirokchilar', exact: true }).click();
  await expect(page.getByText('**********4321', { exact: true })).toBeVisible();
  await expect(page.getByText('Sun’iy ko‘cha, Namuna shahri', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Audit jurnali', exact: true }).click();
  await expect(page.locator('table')).toBeVisible();
  await shot('auditor');
  assert.deepEqual(errors, []);
  await writeFile(
    join(output, 'browser-result.json'),
    JSON.stringify(
      {
        passed: true,
        caseCreation: true,
        referenceEditor: true,
        preview: true,
        claim: true,
        document: true,
        autosave: true,
        offlineSync: true,
        score: 100,
        headApproval: true,
        auditorMasking: true,
        i18n: ['uz-Latn', 'uz-Cyrl', 'ru'],
        mobileOverflow: false,
        axeViolations: accessibility.violations.length,
        consoleErrors: errors.length,
      },
      null,
      2,
    ),
  );
  process.stdout.write('Case module browser E2E passed.\n');
} catch (error) {
  await shot('failure').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
  if (caseId) {
    await db.qualificationAnswer.deleteMany({ where: { caseId } });
    await db.caseFile.delete({ where: { id: caseId } });
    if (personId) await db.person.deleteMany({ where: { id: personId, cases: { none: {} } } });
  }
  await db.auditLog.deleteMany({ where: { actorId: { in: users.map((u) => u.id) } } });
  await db.refreshToken.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
  for (const path of createdFiles) {
    if (path.startsWith(resolve('.local/case-files') + sep))
      await rm(path, { recursive: true, force: true });
  }
}
