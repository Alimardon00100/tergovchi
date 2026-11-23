import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { chromium, expect as browserExpect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { createHarness, firstCase, password } from './support/case-opening';
import type { Harness } from './support/case-opening';

let h: Harness, browser: Browser;
beforeAll(async () => {
  vi.stubEnv('FF_CASE_OPENING_V2', 'false');
  h = await createHarness(true);
}, 30000);
afterAll(async () => {
  await browser?.close();
  await h?.close();
  vi.unstubAllEnvs();
});
it('keeps flag-off legacy workspace, authentication and existing rooms operational', async () => {
  await h.app.listen(0, '127.0.0.1');
  const address = h.server.server.address();
  if (!address || typeof address === 'string') throw Error('Test listener absent');
  vi.stubEnv('PORT', String(address.port));
  const base = 'http://127.0.0.1:' + address.port;
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const login = await context.request.post(base + '/api/auth/login', {
    data: { email: h.accounts[0]?.email, password },
  });
  expect(login.status()).toBe(201);
  for (const path of ['/board', '/profile', '/statistics', '/investigation-room']) {
    await page.goto(base + path);
    await browserExpect(page.locator('#main-content')).toBeVisible();
    await browserExpect(page.locator('.fatal-error, [role="alert"]')).toHaveCount(0);
    await browserExpect(page).toHaveURL(base + path);
  }
  await page.goto(base + '/case-files');
  const folder = page.locator('.case-file-folder').filter({ hasText: '1-2026-001' });
  await folder.getByRole('button', { name: 'Ko‘rish', exact: true }).click();
  await browserExpect(
    page.getByRole('dialog').getByText('Ochilgan sana', { exact: false }),
  ).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Ishni olish', exact: true }).click();
  await browserExpect(page).toHaveURL(base + '/case-files/' + firstCase);
  await browserExpect(page.getByRole('tab', { name: 'Ishtirokchilar', exact: true })).toBeVisible();
  await browserExpect(page.getByRole('tab', { name: 'Natija', exact: true })).toBeVisible();
  expect((await context.request.get(base + `/api/v2/cases/${firstCase}`)).status()).toBe(404);
  expect(errors).toEqual([]);
}, 30000);
