import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { chromium, expect as browserExpect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { createHarness, firstCase, password, saveAnswers } from './support/case-opening';
import type { Harness } from './support/case-opening';
import { qualificationSection } from './support/opening-browser';

let h: Harness, browser: Browser;
beforeAll(async () => {
  vi.stubEnv('FF_CASE_OPENING_V2', 'true');
  vi.stubEnv('FF_CASE_OPENING_V2_PERCENTAGE', '100');
  h = await createHarness(true);
}, 30000);
afterAll(async () => {
  await browser?.close();
  await h?.close();
  vi.unstubAllEnvs();
});
it('preserves an unsent offline answer when the runtime flag rolls back to v1', async () => {
  await h.request('user', 'POST', `/cases/${firstCase}/lock`, undefined, 'v2');
  await saveAnswers(h, 'v2');
  await h.app.listen(0, '127.0.0.1');
  const address = h.server.server.address();
  if (!address || typeof address === 'string') throw Error('Test listener absent');
  vi.stubEnv('PORT', String(address.port));
  const base = 'http://127.0.0.1:' + address.port;
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  expect(
    (
      await context.request.post(base + '/api/auth/login', {
        data: { email: h.accounts[0]?.email, password },
      })
    ).status(),
  ).toBe(201);
  const page = await context.newPage();
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto(base + `/cases/${firstCase}/workspace`);
  await page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true }).click();
  const field = qualificationSection(page, 'Obyektiv tomon').locator('textarea');
  await browserExpect(field).toBeEnabled();
  await context.setOffline(true);
  await field.fill('Unsent answer survives runtime rollback');
  await browserExpect(page.locator('.case-save-status')).toContainText('Aloqa yo‘q');
  vi.stubEnv('FF_CASE_OPENING_V2', 'false');
  await context.setOffline(false);
  await page.reload();
  await browserExpect(page.getByRole('tab', { name: 'Ishtirokchilar', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Kvalifikatsiya', exact: true }).click();
  await browserExpect
    .poll(
      async () => {
        const row = await h.db.qualificationAnswer.findFirst({
          where: { caseId: firstCase, elementType: 'OBJECTIVE' },
        });
        return (row?.payload as { note: string } | undefined)?.note;
      },
      { timeout: 6000 },
    )
    .toBe('Unsent answer survives runtime rollback');
}, 30000);
