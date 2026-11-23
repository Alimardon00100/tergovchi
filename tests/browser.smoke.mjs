import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
/* global document, window */
const root = resolve(import.meta.dirname, '..');
process.env['PLAYWRIGHT_BROWSERS_PATH'] ??= join(root, '.cache/playwright');
const { chromium, expect } = await import('@playwright/test');
const base = process.env['E2E_URL'] ?? 'http://127.0.0.1:3000';
assert.match(base, /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/);
const { PrismaClient } = createRequire(join(root, 'apps/api/package.json'))('@prisma/client');
const db = new PrismaClient();
const email = 'qa-browser-' + randomUUID() + '@example.test';
const password = 'Browser QA passphrase 2026';
const adminTitle = 'QA ish ' + randomUUID();
const output = join(root, '.cache/qa/game-ui-v11');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chromium',
  ...(process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
    ? { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] }
    : {}),
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (entry) => {
  if (
    entry.type() === 'error' &&
    !entry.text().includes('401 (Unauthorized)') &&
    !(
      entry.text().includes('400 (Bad Request)') &&
      entry.location().url.endsWith('/api/users/me/password')
    )
  )
    errors.push(entry.text());
});
const screenshot = async (name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(output, name + '.png') });
};
async function noScroll() {
  assert.deepEqual(
    await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > window.innerWidth,
      y: document.documentElement.scrollHeight > window.innerHeight,
    })),
    { x: false, y: false },
    'Scene must fit the viewport',
  );
  await expect(page.locator('header, nav, .sidebar, .case-grid, .stat-grid, select')).toHaveCount(
    0,
  );
}
async function safeFits() {
  assert.equal(
    await page
      .locator('.safe-summary')
      .evaluate(
        (person) =>
          person.offsetTop + person.offsetHeight <=
          document.querySelector('.metal-account-actions').offsetTop + 1,
      ),
    true,
    'Rank and upload controls must not overlap',
  );
  assert.equal(
    await page.locator('.metal-case').evaluateAll((folders) =>
      folders.every((folder) => {
        const title = folder.querySelector('strong');
        const status = folder.querySelector('.metal-case-stamp');
        return title.offsetTop + title.offsetHeight <= status.offsetTop + 1;
      }),
    ),
    true,
    'Shelf folder title and status must not overlap',
  );
}
async function folderFits() {
  assert.equal(
    await page.locator('.case-folder').evaluateAll((folders) =>
      folders.every((folder) => {
        const number = folder.querySelector('.folder-number');
        const title = folder.querySelector('h2');
        const photo = folder.querySelector('.folder-photo');
        return (
          number.offsetTop + number.offsetHeight <= title.offsetTop &&
          number.offsetLeft >= photo.offsetLeft + photo.offsetWidth
        );
      }),
    ),
    true,
    'Case number must have its own strip',
  );
}
async function board() {
  if (!page.url().endsWith('/board'))
    await page.getByRole('link', { name: 'Tergov doskasiga qaytish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tergov doskasi', exact: true })).toBeVisible();
  await expect(page.locator('.game-scene')).toHaveCount(1);
}
async function room(name) {
  await board();
  await page.getByRole('link', { name, exact: true }).click();
  const heading =
    { Statistika: 'Xizmat statistikasi', 'Shaxsiy profil': 'Tergovchi profili' }[name] ?? name;
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect(page.locator('.game-scene')).toHaveCount(1);
}
const protectedDeskHash = '150c0049e019be1ab85044278548b48bc1cb7a89e4cbf421782051b044eea583';
async function verifyDesk() {
  assert.equal(
    createHash('sha256')
      .update(await readFile(join(root, 'apps/web/public/scenes/desk.webp')))
      .digest('hex'),
    protectedDeskHash,
  );
}
async function choosePaper(label, name) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name, exact: true }).click();
}
try {
  await verifyDesk();
  await page.goto(base + '/login');
  await expect(page.getByRole('heading', { name: 'Xush kelibsiz, tergovchi.' })).toBeVisible();
  await screenshot('login');
  await page.getByRole('link', { name: 'Ro‘yxatdan o‘tish', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ism va familiya' }).fill('Alimardon Xursandov');
  await page.getByRole('textbox', { name: 'Elektron pochta' }).fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Tergovchi bo‘lish', exact: true }).click();
  await expect(page).toHaveURL(base + '/board');
  await board();
  await noScroll();
  await expect(page.locator('.red-strings path')).toHaveCount(8);
  await expect(page.locator('.credential-points')).toContainText('0 ball');
  await expect(page.getByRole('button', { name: 'Hisobdan chiqish', exact: true })).toHaveCount(0);
  await expect(page.getByAltText('Tergovchi silueti')).toBeVisible();
  await screenshot('board');
  const connected = await page.evaluate(() => {
    const stage = document.querySelector('.cork-stage').getBoundingClientRect();
    const pins = Array.from(document.querySelectorAll('[data-thread-pin]')).map((pin) => {
      const p = pin.getBoundingClientRect();
      return { x: p.x + p.width / 2 - stage.x, y: p.y + p.height / 2 - stage.y };
    });
    return Array.from(document.querySelectorAll('.red-strings path')).every((path) =>
      [path.getPointAtLength(0), path.getPointAtLength(path.getTotalLength())].every((end) =>
        pins.some((pin) => Math.hypot(pin.x - end.x, pin.y - end.y) < 3),
      ),
    );
  });
  assert.equal(connected, true, 'Red threads must end on actual pushpins');

  await room('Shaxsiy profil');
  await expect(page.locator('.summary-rank img')).toHaveAttribute('src', '/ranks/lieutenant.png');
  await expect(page.locator('.summary-rank img')).toBeVisible();
  await screenshot('initial-safe');
  await page.getByRole('button', { name: 'To‘liq profilni ochish', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'To‘liq profil', exact: true })
      .getByText('Alimardon Xursandov', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  assert.equal(new URL(page.url()).pathname, '/profile');
  await room('Tergov xonasi');
  await expect(page.locator('.case-folder')).toHaveCount(6);
  await expect
    .poll(() =>
      page
        .locator('.folder-photo img')
        .evaluateAll((images) => images.every((photo) => photo.complete && photo.naturalWidth > 0)),
    )
    .toBe(true);
  const photoUrls = await page
    .locator('.folder-photo img')
    .evaluateAll((images) => images.map((photo) => photo.currentSrc));
  assert.equal(new Set(photoUrls).size, 6, 'Every seed case needs a distinct portrait');
  await noScroll();
  await folderFits();
  await page.getByRole('combobox', { name: /^Holat/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await screenshot('paper-filter');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  assert.equal(new URL(page.url()).pathname, '/investigation-room');
  await screenshot('investigation');
  await choosePaper('Qiyinchilik bo‘yicha saralash', 'Oson');
  await expect(page.locator('.case-folder')).toHaveCount(2);
  await choosePaper('Qiyinchilik bo‘yicha saralash', 'Barcha darajalar');
  await page.getByRole('textbox', { name: 'Xonadagi ishlarni qidirish' }).fill('mavjud-emas-qa');
  await expect(page.locator('.case-folder')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Xonadagi ishlarni qidirish' }).fill('');
  await page.locator('.case-folder').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Dalillar tergov boshlanganda ochiladi')).toBeVisible();
  await dialog.getByRole('button', { name: 'Ishni boshlash', exact: true }).click();
  await expect(dialog.locator('.evidence-record')).toHaveCount(3);
  await expect
    .poll(async () => (await db.user.findUniqueOrThrow({ where: { email } })).points)
    .toBe(20);
  await screenshot('case');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  assert.equal(
    page.url().endsWith('/investigation-room'),
    true,
    'Escape must close only the folder',
  );
  await page.reload();
  await expect(page.locator('.case-folder').first()).toContainText('JARAYONDA');
  await room('Nazorat zali');
  await expect(page.locator('.case-folder')).toHaveCount(1);
  await screenshot('control');
  await room('Himoya xonasi');
  await expect(page.locator('.case-folder')).toHaveCount(1);
  await screenshot('defense');
  await room('Tergov xonasi');
  await page.locator('.case-folder').first().click();
  await expect(dialog.getByRole('button', { name: 'Ishni boshlash', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Tergovni yakunlash', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await room('Hukm zali');
  await expect(page.locator('.case-folder')).toHaveCount(1);
  await screenshot('judgment');
  await room('Tergov xonasi');
  for (let index = 1; index < 6; index++) {
    await page.locator('.case-folder').nth(index).click();
    await dialog.getByRole('button', { name: 'Ishni boshlash', exact: true }).click();
    await expect(dialog.locator('.evidence-record')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  assert.equal(user.points, 200);
  assert.equal(user.rankName, 'SENIOR_LIEUTENANT');
  assert.equal(await db.pointTransaction.count({ where: { userId: user.id } }), 6);
  await expect(page.getByRole('heading', { name: 'Yangi unvon muborak!' })).toBeVisible();
  await room('Statistika');
  await expect(page.getByRole('heading', { name: 'Izlanishlar samarasi' })).toBeVisible();
  await expect(page.locator('.rank-celebration')).toHaveCount(0, { timeout: 5000 });
  await screenshot('statistics');
  await room('Shaxsiy profil');
  await expect(page.locator('.metal-safe')).toHaveAttribute('data-state', 'open');
  await expect(page.locator('.metal-tool-shelf,.metal-case-shelf')).toHaveCount(3);
  await expect(
    page
      .locator('.metal-profile-info')
      .getByRole('button', { name: 'Hisobdan chiqish', exact: true }),
  ).toBeVisible();

  await expect(page.locator('.summary-rank img')).toHaveAttribute(
    'src',
    '/ranks/senior_lieutenant.png',
  );
  await page.getByRole('button', { name: 'To‘liq profilni ochish', exact: true }).click();
  const fullProfile = page.getByRole('dialog', { name: 'To‘liq profil', exact: true });
  await expect(fullProfile.getByText(email, { exact: true })).toBeVisible();
  await expect(fullProfile.getByText('Ro‘yxatdan o‘tgan sana', { exact: true })).toBeVisible();
  await screenshot('full-profile');
  await fullProfile.getByRole('button', { name: 'Tahrirlash', exact: true }).click();
  await fullProfile
    .getByRole('textbox', { name: 'Ism va familiya', exact: true })
    .fill('Aziz Tergovchi');
  await fullProfile
    .getByLabel('Avatar rasmini yuklash', { exact: true })
    .setInputFiles(join(root, 'apps/web/public/suspects/letter.webp'));
  await expect(fullProfile.getByAltText('Tanlangan yangi avatar')).toBeVisible();
  await screenshot('edit-profile');
  await fullProfile.getByRole('button', { name: 'Saqlash', exact: true }).click();
  await expect
    .poll(async () => (await db.user.findUniqueOrThrow({ where: { email } })).displayName)
    .toBe('Aziz Tergovchi');
  await expect
    .poll(async () => (await db.user.findUniqueOrThrow({ where: { email } })).avatarKey)
    .toMatch(/^avatars\//);
  await expect(fullProfile.getByRole('button', { name: 'Tahrirlash', exact: true })).toBeVisible();
  await fullProfile.getByRole('button', { name: 'Yopish', exact: true }).click();
  await page.getByRole('button', { name: 'Profilni tahrirlash', exact: true }).click();
  await expect(
    fullProfile.getByRole('textbox', { name: 'Ism va familiya', exact: true }),
  ).toHaveValue('Aziz Tergovchi');
  await fullProfile.getByRole('button', { name: 'Yopish', exact: true }).click();
  await page.reload();
  await expect(page.locator('.safe-summary .detective-avatar')).toHaveAttribute(
    'src',
    /^\/api\/media\/avatars\//,
  );
  await safeFits();
  await screenshot('safe');
  await page.setViewportSize({ width: 1024, height: 572 });
  await safeFits();
  await screenshot('reference-safe');
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(page.locator('.metal-opened [data-case-id]')).toHaveCount(1);
  await expect(page.locator('.metal-unopened [data-case-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'OCHILGAN ISHLAR: Hammasi', exact: true }).click();
  const allCasesDialog = page.getByRole('dialog', { name: 'Barcha jinoyat ishlari', exact: true });
  await expect(allCasesDialog.locator('[data-case-id]')).toHaveCount(6);
  await expect(allCasesDialog.locator('.metal-case-thumbnail img')).toHaveCount(6);
  await expect(
    allCasesDialog.locator('.metal-case-stamp').filter({ hasText: 'JARAYONDA' }),
  ).toHaveCount(5);
  await noScroll();
  await screenshot('all-cases');
  await allCasesDialog.getByRole('button', { name: 'Yopish', exact: true }).click();
  const selected = await page
    .locator('.metal-opened [data-case-id]')
    .first()
    .getAttribute('data-case-id');
  await page.locator('.metal-opened [data-case-id]').first().click();
  await expect(page).toHaveURL(new RegExp('/investigation-room\\?case=' + selected));
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.scene-desk .scene-backdrop')).toHaveCSS(
    'background-image',
    new RegExp('/scenes/desk\\.webp'),
  );
  await page.keyboard.press('Escape');
  await board();
  await page.setViewportSize({ width: 375, height: 812 });
  await noScroll();
  await screenshot('mobile-board');
  await room('Shaxsiy profil');
  await expect(page.locator('.metal-safe')).toHaveAttribute('data-state', 'open');
  await noScroll();
  await safeFits();
  await screenshot('mobile-safe');
  await page.getByRole('button', { name: 'Javonlar', exact: true }).click();
  await expect(page.locator('.metal-tool-shelf')).toBeVisible();

  await screenshot('mobile-shelves');
  await page.getByRole('button', { name: 'OCHILMAGAN ISHLAR: Hammasi', exact: true }).click();
  await expect(allCasesDialog.locator('[data-case-id]')).toHaveCount(2);
  await allCasesDialog.getByRole('button', { name: 'Keyingi', exact: true }).click();
  await expect(allCasesDialog.locator('.all-cases-pagination')).toContainText('2/3');
  await noScroll();
  await screenshot('mobile-all-cases');
  await page.keyboard.press('Escape');
  assert.equal(new URL(page.url()).pathname, '/profile');

  await board();
  await room('Tergov xonasi');
  await expect(page.locator('.case-folder')).toHaveCount(2);
  await noScroll();
  await folderFits();
  await screenshot('mobile-room');
  await page.getByRole('button', { name: 'Keyingi', exact: true }).click();
  await expect(page.locator('.paper-pager')).toContainText('2 / 3');
  await page.locator('.case-folder').first().click();
  await expect(dialog.locator('.evidence-record')).toHaveCount(3);
  await screenshot('mobile-case');
  await page.keyboard.press('Escape');
  await room('Statistika');
  await page.getByRole('button', { name: 'Qaydlar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tergov qaydlari' })).toBeVisible();
  await noScroll();
  await board();
  await page.setViewportSize({ width: 320, height: 568 });
  await noScroll();
  await screenshot('small-board');
  await room('Shaxsiy profil');
  await expect(page.locator('.metal-safe')).toHaveAttribute('data-state', 'open');
  await noScroll();
  await safeFits();
  await screenshot('small-safe');
  await page.getByRole('button', { name: 'Javonlar', exact: true }).click();
  await expect(page.locator('.metal-tool-shelf')).toBeVisible();

  await screenshot('small-shelves');
  await page.getByRole('button', { name: 'OCHILGAN ISHLAR: Hammasi', exact: true }).click();
  await noScroll();

  assert.equal(
    await allCasesDialog.evaluate((dialog) => {
      const description = dialog.querySelector('p').getBoundingClientRect();
      return Array.from(dialog.querySelectorAll('.metal-folder-tab')).every(
        (tab) => tab.getBoundingClientRect().top > description.bottom,
      );
    }),
    true,
    'Archive folders must stay below the description',
  );
  await screenshot('small-all-cases');
  await allCasesDialog.getByRole('button', { name: 'Yopish', exact: true }).click();

  await board();
  await room('Tergov xonasi');
  await noScroll();
  await folderFits();
  await screenshot('small-room');
  await board();
  await page.setViewportSize({ width: 1440, height: 900 });
  await room('Shaxsiy profil');
  await page
    .locator('.metal-profile-info')
    .getByRole('button', { name: 'Hisobdan chiqish', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Xush kelibsiz, tergovchi.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Elektron pochta' }).fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Ish maydoniga kirish', exact: true }).click();
  await expect(page).toHaveURL(base + '/board');
  await board();
  await expect(page.locator('.credential-points')).toContainText('200 ball');
  await db.user.update({ where: { email }, data: { role: 'ADMIN' } });
  await page.reload();
  await board();
  await page.getByRole('link', { name: 'Maxfiy arxiv', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Maxfiy arxiv', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Yangi ish qo‘shish', exact: true }).click();
  const adminDialog = page.getByRole('dialog');
  await expect(adminDialog.locator('select')).toHaveCount(0);
  await adminDialog.getByRole('combobox').click();
  await page.getByRole('option', { name: /^Murakkab/ }).click();
  await adminDialog.getByRole('combobox').click();
  await page.getByRole('option', { name: /^Oson/ }).click();
  await adminDialog.getByRole('textbox', { name: 'Ish nomi', exact: true }).fill(adminTitle);
  await adminDialog
    .getByRole('textbox', { name: 'Qisqa tavsif', exact: true })
    .fill('Faqat brauzer tekshiruvi uchun vaqtinchalik ish.');
  await adminDialog
    .getByRole('textbox', { name: 'To‘liq tafsilotlar', exact: true })
    .fill('Bu ish faqat interfeys yaratish oqimini tekshirish uchun qo‘shildi.');
  await adminDialog.getByRole('button', { name: 'Ishni e’lon qilish', exact: true }).click();
  await expect(adminDialog.getByRole('alert')).toContainText('Jinoyat ishi rasmi majburiy.');
  await adminDialog
    .getByLabel('Jinoyat ishi rasmini yuklash', { exact: true })
    .setInputFiles(join(root, 'apps/web/public/suspects/phone.webp'));
  await adminDialog.getByRole('button', { name: 'Ishni e’lon qilish', exact: true }).click();
  await expect(adminDialog).toHaveCount(0);
  await expect(page.getByRole('cell', { name: adminTitle, exact: true })).toBeVisible();
  assert.equal((await db.case.findFirstOrThrow({ where: { title: adminTitle } })).basePoints, 20);
  const createdCase = await db.case.findFirstOrThrow({ where: { title: adminTitle } });
  assert.match(createdCase.coverAssetKey, /^cases\//);
  assert.equal(
    createdCase.customPoints,
    null,
    'Empty custom points must preserve the difficulty award',
  );
  await page.goto(base + '/investigation-room?case=' + createdCase.id);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.case-cover-photo img')).toHaveAttribute(
    'src',
    '/api/media/' + createdCase.coverAssetKey,
  );
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.case-actions')).toContainText('+20 ball');

  await screenshot('uploaded-case');
  await page.keyboard.press('Escape');
  await room('Shaxsiy profil');
  await page.getByRole('button', { name: 'OCHILMAGAN ISHLAR: Hammasi', exact: true }).click();
  await allCasesDialog.getByRole('button', { name: 'Keyingi', exact: true }).click();
  const uploadedFolder = allCasesDialog.locator('[data-case-id="' + createdCase.id + '"]');
  await expect(uploadedFolder.locator('img')).toHaveAttribute(
    'src',
    '/api/media/' + createdCase.coverAssetKey,
  );
  await screenshot('uploaded-case-in-archive');
  await uploadedFolder.click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await board();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await board();
  const beforeHover = await page.locator('.red-strings path').first().getAttribute('d');
  await page.getByRole('link', { name: 'Tergov xonasi', exact: true }).hover();
  await expect
    .poll(() => page.locator('.red-strings path').first().getAttribute('d'))
    .not.toBe(beforeHover);
  await room('Tergov xonasi');
  await expect(page.locator('.game-scene')).toHaveCount(1);
  await page.locator('.case-folder').first().click();
  await expect(dialog).toBeVisible();
  await screenshot('animated-folder');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await room('Shaxsiy profil');
  await expect(page.locator('.metal-safe')).toHaveAttribute('data-state', 'open');
  await page.getByRole('button', { name: 'Seyfni yopish', exact: true }).click();
  await expect(page.locator('.metal-safe-door')).toHaveCSS('transform', 'none');
  await screenshot('safe-closed');
  await page.getByRole('button', { name: 'Seyfni ochish', exact: true }).click();
  await expect(page.locator('.metal-safe-door')).toHaveCSS('transform', /^matrix3d\(-0\./);
  await expect(page.locator('.metal-profile-info')).toBeVisible();
  await noScroll();
  await verifyDesk();
  await page.getByRole('button', { name: 'Parolni o‘zgartirish', exact: true }).click();
  const passwordDialog = page.getByRole('dialog', { name: 'Parolni o‘zgartirish', exact: true });
  await passwordDialog
    .getByLabel('Amaldagi parol', { exact: true })
    .fill('incorrect current password');
  await passwordDialog
    .getByLabel('Yangi parol', { exact: true })
    .fill('Changed browser QA passphrase 2026');
  await passwordDialog
    .getByLabel('Yangi parolni takrorlang', { exact: true })
    .fill('Changed browser QA passphrase 2026');
  await passwordDialog.getByRole('button', { name: 'Parolni saqlash', exact: true }).click();
  await expect(passwordDialog.getByRole('alert')).toContainText('Amaldagi parol noto‘g‘ri.');
  await passwordDialog.getByLabel('Amaldagi parol', { exact: true }).fill(password);
  await screenshot('password-desktop');
  await page.keyboard.press('Escape');
  await expect(passwordDialog).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Parolni o‘zgartirish', exact: true }).click();
  await passwordDialog.getByLabel('Amaldagi parol', { exact: true }).fill(password);
  await passwordDialog
    .getByLabel('Yangi parol', { exact: true })
    .fill('Changed browser QA passphrase 2026');
  await noScroll();
  await passwordDialog
    .getByLabel('Yangi parolni takrorlang', { exact: true })
    .fill('Changed browser QA passphrase 2026');
  await screenshot('password-mobile');

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'To‘liq profilni ochish', exact: true }).click();
  await fullProfile.getByRole('button', { name: 'Tahrirlash', exact: true }).click();
  await fullProfile.getByRole('button', { name: 'Parolni o‘zgartirish', exact: true }).click();
  await fullProfile
    .getByRole('textbox', { name: 'Ism va familiya', exact: true })
    .fill('Aziz Tergovchi II');
  const profilePassword = fullProfile.getByRole('form', {
    name: 'Parolni almashtirish formasi',
    exact: true,
  });
  await profilePassword.getByLabel('Amaldagi parol', { exact: true }).fill(password);
  await profilePassword
    .getByLabel('Yangi parol', { exact: true })
    .fill('Changed browser QA passphrase 2026');
  await profilePassword
    .getByLabel('Yangi parolni takrorlang', { exact: true })
    .fill('mismatched confirmation');
  await profilePassword.getByRole('button', { name: 'Parolni saqlash', exact: true }).click();
  await expect(
    profilePassword.getByText('Yangi parol va takroriy parol mos emas.', { exact: true }),
  ).toBeVisible();
  await profilePassword
    .getByLabel('Yangi parolni takrorlang', { exact: true })
    .fill('Changed browser QA passphrase 2026');
  await screenshot('full-profile-password');
  await fullProfile.getByRole('button', { name: 'Saqlash', exact: true }).click();
  await expect(page).toHaveURL(base + '/login');
  await page.getByRole('textbox', { name: 'Elektron pochta' }).fill(email);
  await page.locator('input[name="password"]').fill('Changed browser QA passphrase 2026');
  await page.getByRole('button', { name: 'Ish maydoniga kirish', exact: true }).click();
  await expect(page).toHaveURL(base + '/board');
  await board();
  await expect(page.locator('.credential-points')).toContainText('200 ball');
  assert.equal(
    await db.auditLog.count({ where: { actorId: user.id, action: 'PASSWORD_CHANGED' } }),
    1,
  );
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { email } })).displayName,
    'Aziz Tergovchi II',
  );
  assert.deepEqual(errors, [], 'Browser console/page errors');
  process.stdout.write(
    JSON.stringify({
      status: 'passed',
      checks: [
        'auth',
        'all rooms',
        'pushpin connections',
        'no page scroll',
        'paper filters',
        'folder/evidence',
        'persistent points',
        'rank-up',
        'statistics',
        'three safe shelves and right-opening door',
        'provided PNG rank photos change with rank',
        'closed-only shelf, case thumbnails and view-all document',
        'full profile editor, avatar, name and confirmed password',
        'password dialog, wrong old password, successful change and re-login',
        'persistent avatar upload',
        'exact case deep link',
        'unchanged investigation background',
        'case number and shelf text geometry',
        '375/320 mobile pagination',
        'mandatory admin image and persisted cover',
        'animated transitions',
        'no browser errors',
      ],
      screenshots: output,
    }) + '\n',
  );
} catch (error) {
  await screenshot('failure').catch(() => undefined);
  process.stderr.write(
    'Browser QA failed at ' +
      page.url() +
      ': ' +
      (error instanceof Error ? error.message : 'Unknown error') +
      '\n',
  );
  process.exitCode = 1;
} finally {
  await browser.close();
  const own = await db.user.findUnique({ where: { email } });
  const ownedCase = await db.case.findFirst({ where: { title: adminTitle } });
  const mediaKeys = [own?.avatarKey, ownedCase?.coverAssetKey].filter(Boolean);
  if (own && email.startsWith('qa-browser-') && email.endsWith('@example.test'))
    await db.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { actorId: own.id } });
      await tx.pointTransaction.deleteMany({ where: { userId: own.id } });
      await tx.userCaseProgress.deleteMany({ where: { userId: own.id } });
      await tx.refreshToken.deleteMany({ where: { userId: own.id } });
      await tx.user.delete({ where: { id: own.id, email } });
    });
  const created = await db.case.findFirst({ where: { title: adminTitle } });
  if (created?.title === adminTitle) await db.case.delete({ where: { id: created.id } });
  for (const key of mediaKeys) {
    assert.ok(own && key.split('/')[1] === own.id);
    const mediaRoot = resolve(root, '.local/uploads');
    const filename = resolve(mediaRoot, key);
    assert.ok(filename.startsWith(mediaRoot + sep));
    await rm(filename, { force: true });
  }
  await db.$disconnect();
}
