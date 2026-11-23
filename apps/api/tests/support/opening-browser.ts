import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export function qualificationSection(page: Page, name: string) {
  return page
    .locator('.case-qualification details')
    .filter({ has: page.locator('summary').filter({ hasText: new RegExp('^' + name + ' ') }) });
}
export async function pick(page: Page, scope: Locator, name: string, option: string) {
  await scope.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
export async function fillQualification(page: Page, person: string, wrong = false) {
  const subject = qualificationSection(page, 'Subyekt');
  await subject.getByRole('checkbox', { name: new RegExp(person) }).check();
  if (wrong) await pick(page, subject, 'Ishtirokchilik turi', 'Yordamchi');
  await qualificationSection(page, 'Obyekt')
    .getByRole('checkbox', { name: 'Mulk', exact: true })
    .check();
  const objective = qualificationSection(page, 'Obyektiv tomon');
  await pick(page, objective, 'Harakat turi', 'Harakat');
  await objective.getByRole('checkbox', { name: 'Moddiy zarar', exact: true }).check();
  await pick(page, objective, 'Sababiy bog‘lanish', 'Mavjud');
  const subjective = qualificationSection(page, 'Subyektiv tomon');
  await pick(page, subjective, 'Aybdorlik shakli', 'Qasddan');
  await pick(page, subjective, 'Qasd turi', 'To‘g‘ri qasd');
  await pick(page, subjective, 'Motiv', 'G‘araz');
  await pick(page, subjective, 'Maqsad', 'Boyish');
  await expect(page.getByRole('button', { name: 'Tekshirish', exact: true })).toBeEnabled();
}
