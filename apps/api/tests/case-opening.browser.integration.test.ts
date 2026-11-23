import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { chromium, expect as browserExpect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { createHarness, firstCase, missingCase, password } from './support/case-opening';
import type { Harness } from './support/case-opening';
import { fillQualification, pick, qualificationSection } from './support/opening-browser';

let h: Harness,
  browser: Browser,
  context: BrowserContext,
  page: Page,
  base = '';
const output = resolve('../../.cache/case-opening-v2-qa');
const errors: string[] = [];
async function note() {
  const row = await h.db.qualificationAnswer.findFirst({
    where: { caseId: firstCase, elementType: 'OBJECTIVE' },
    orderBy: { updatedAt: 'desc' },
  });
  return (row?.payload as { note?: string } | undefined)?.note ?? '';
}
async function login(ctx: BrowserContext, index = 0) {
  const response = await ctx.request.post(base + '/api/auth/login', {
    data: { email: h.accounts[index]?.email, password },
  });
  expect(response.status()).toBe(201);
}
beforeAll(async () => {
  vi.stubEnv('FF_CASE_OPENING_V2', 'true');
  vi.stubEnv('FF_CASE_OPENING_V2_PERCENTAGE', '100');
  await mkdir(output, { recursive: true });
  h = await createHarness(true);
  const original = await h.db.caseDocument.findFirstOrThrow({ where: { caseId: firstCase } });
  for (const type of [
    'EXPERT_REPORT',
    'WITNESS_TESTIMONY',
    'SUSPECT_TESTIMONY',
    'EVIDENCE_PHOTO',
  ] as const) {
    const image = type === 'EVIDENCE_PHOTO',
      id = randomUUID(),
      storageKey = `${firstCase}/${id}.${image ? 'webp' : 'pdf'}`;
    const bytes = image
      ? await sharp({ create: { width: 160, height: 100, channels: 3, background: '#745b41' } })
          .webp()
          .toBuffer()
      : await readFile(join(h.temp, 'case-files', original.storageKey));
    await writeFile(join(h.temp, 'case-files', storageKey), bytes);
    await h.db.caseDocument.create({
      data: {
        caseId: firstCase,
        id,
        storageKey,
        type,
        title: 'QA ' + type,
        mime: image ? 'image/webp' : 'application/pdf',
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        isEvidence: image,
        authorId: original.authorId,
      },
    });
  }
  await h.app.listen(0, '127.0.0.1');
  const address = h.server.server.address();
  if (!address || typeof address === 'string') throw Error('Test listener absent');
  base = 'http://127.0.0.1:' + address.port;
  vi.stubEnv('PORT', String(address.port));
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await login(context);
}, 30000);
afterAll(async () => {
  if (page && !page.isClosed())
    await page
      .screenshot({ path: join(output, 'last-state.png'), fullPage: true })
      .catch(() => undefined);
  await browser?.close();
  await h?.close();
  vi.unstubAllEnvs();
});
describe('Case opening v2 browser flows', () => {
  it('preview hides evidence and claim opens the workspace with ordered tabs', async () => {
    await page.goto(base + '/case-files');
    const folder = page.locator('.case-file-folder').filter({ hasText: '1-2026-001' });
    await folder.getByRole('button', { name: 'Ko‘rish', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await browserExpect(dialog.getByText('Ochilgan sana', { exact: false })).toBeVisible();
    await browserExpect(dialog.locator('iframe, .case-evidence, .case-person-sheet')).toHaveCount(
      0,
    );
    await browserExpect(dialog.getByText(originalTitle())).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Ishni olish', exact: true }).click();
    await browserExpect(page).toHaveURL(base + `/cases/${firstCase}/workspace`);
    await browserExpect(page.getByRole('tab')).toHaveText([
      'Umumiy',
      'Hujjatlar',
      'Gumondorlar',
      'Kvalifikatsiya',
    ]);
    await browserExpect(page.getByRole('tab', { name: 'Natija', exact: true })).toHaveCount(0);
    await page.screenshot({ path: join(output, 'workspace.png'), fullPage: true });
  });
  it('shows a disabled conflicting claim with its explanation to another investigator', async () => {
    const other = await browser.newContext();
    await login(other, 1);
    try {
      expect((await other.request.post(base + `/api/v2/cases/${firstCase}/lock`)).status()).toBe(
        409,
      );
      const second = await other.newPage();
      await second.goto(base + '/case-files');
      const folder = second.locator('.case-file-folder').filter({ hasText: '1-2026-001' });
      await browserExpect(
        folder.getByRole('button', { name: 'Ishni olish', exact: true }),
      ).toBeDisabled();
      await browserExpect(folder.locator('span[title]')).toHaveAttribute(
        'title',
        /boshqa tergovchida/,
      );
    } finally {
      await other.close();
    }
  });
  it('filters all five document types and opens PDF and evidence images', async () => {
    await page.getByRole('tab', { name: 'Hujjatlar', exact: true }).click();
    await browserExpect(page.locator('.case-document-row')).toHaveCount(5);
    await page
      .locator('.case-document-row')
      .filter({ hasText: originalTitle() })
      .getByRole('button')
      .click();
    await browserExpect(page.locator('.case-document-viewer iframe')).toBeVisible();
    await page
      .locator('.case-document-viewer')
      .getByRole('button', { name: 'Yopish', exact: true })
      .click();
    await pick(
      page,
      page.getByRole('tabpanel', { name: 'Hujjatlar', exact: true }),
      'Hujjat turi',
      'Dalil surati',
    );
    await browserExpect(page.locator('.case-document-row')).toHaveCount(1);
    await browserExpect(page.locator('.case-evidence')).toHaveText('DALIL');
    await page.locator('.case-document-row').getByRole('button').click();
    await browserExpect(page.locator('.case-document-viewer img')).toBeVisible();
    await page.getByRole('tab', { name: 'Gumondorlar', exact: true }).click();
    await browserExpect(page.locator('.case-person-sheet').first()).toContainText('Jinsi');
    await browserExpect(page.locator('.case-person-sheet').first()).toContainText('Aloqa');
  });
  it('autosaves in two seconds, retains a pending change when switching tabs and supports offline recovery', async () => {
    await page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true }).click();
    await fillQualification(page, 'Jamshid', true);
    const objective = qualificationSection(page, 'Obyektiv tomon');
    await objective.locator('textarea').fill('Autosave baseline');
    await browserExpect.poll(note, { timeout: 6000 }).toBe('Autosave baseline');
    await objective.locator('textarea').fill('Saved across tabs');
    await page.getByRole('tab', { name: 'Umumiy', exact: true }).click();
    await browserExpect.poll(note, { timeout: 6000 }).toBe('Saved across tabs');
    await page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true }).click();
    await context.setOffline(true);
    await objective.locator('textarea').fill('Recovered offline');
    await browserExpect(page.locator('.case-save-status')).toContainText('Aloqa yo‘q');
    expect(await note()).toBe('Saved across tabs');
    await context.setOffline(false);
    await browserExpect.poll(note, { timeout: 6000 }).toBe('Recovered offline');
  });
  it('rolls back rejected autosaves after lock loss and resumes after reclaim', async () => {
    await browserExpect(page.locator('.case-save-status')).toContainText('Serverda saqlandi');
    await h.db.caseLock.update({
      where: { caseId: firstCase },
      data: { lockedAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) },
    });
    const noteField = qualificationSection(page, 'Obyektiv tomon').locator('textarea');
    await noteField.fill('Rejected optimistic value');
    await browserExpect(
      page.getByRole('alert').filter({ hasText: 'Ishni qayta oling' }),
    ).toBeVisible({ timeout: 6000 });
    await browserExpect(noteField).toHaveValue('Recovered offline');
    expect(await note()).toBe('Recovered offline');
    await page.getByRole('tab', { name: 'Umumiy', exact: true }).click();
    await page.getByRole('button', { name: 'Ishni qayta olish', exact: true }).click();
    await page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true }).click();
    await browserExpect(
      page.getByRole('button', { name: 'Tekshirish', exact: true }),
    ).toBeEnabled();
  });
  it('has no automated WCAG AA violations and scores fifty when only the subject is wrong', async () => {
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    await writeFile(join(output, 'accessibility.json'), JSON.stringify(axe.violations, null, 2));
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path: join(output, 'qualification.png'), fullPage: true });
    await page.getByRole('button', { name: 'Tekshirish', exact: true }).click();
    await browserExpect(page.getByRole('tab', { name: 'Natija', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await browserExpect(page.getByRole('tabpanel', { name: 'Natija', exact: true })).toContainText(
      '50/100',
    );
    expect(
      (
        await h.db.caseScore.findFirstOrThrow({ where: { caseId: firstCase } })
      ).totalScore.toNumber(),
    ).toBe(50);
  });
  it('disables submit for missing references and supports keyboard tabs on mobile', async () => {
    expect((await context.request.post(base + `/api/v2/cases/${missingCase}/lock`)).status()).toBe(
      200,
    );
    await page.goto(base + `/cases/${missingCase}/workspace`);
    await page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true }).click();
    await browserExpect(page.getByText('Etalon kiritilmagan.', { exact: true })).toBeVisible();
    await browserExpect(
      page.getByRole('button', { name: 'Tekshirish', exact: true }),
    ).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true }).focus();
    await page.keyboard.press('Home');
    await browserExpect(page.getByRole('tab', { name: 'Umumiy', exact: true })).toBeFocused();
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
    await page.screenshot({ path: join(output, 'mobile.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
});
function originalTitle() {
  return 'Dastlabki tekshiruv protokoli (o‘quv)';
}
