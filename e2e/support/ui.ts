import { Locator, Page, expect } from '@playwright/test';

import { E2E } from './env';

/** Login pela tela (FC1). Os ids já existem no template; nenhum data-testid foi criado para o E2E. */
export async function login(
  page: Page,
  email = E2E.adminEmail,
  password = E2E.adminPassword,
): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#btn-login').click();
}

export async function loginAndWaitForRooms(
  page: Page,
  email?: string,
  password?: string,
): Promise<void> {
  await login(page, email, password);
  await expect(page).toHaveURL(/\/admin\/rooms/);
  await expect(roomCards(page).first()).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
}

export function roomCards(page: Page): Locator {
  return page
    .locator('mat-card')
    .filter({ has: page.locator('mat-card-title', { hasText: /^Quarto / }) });
}

export function roomCard(page: Page, number: string): Locator {
  return page
    .locator('mat-card')
    .filter({ has: page.locator('mat-card-title', { hasText: new RegExp(`^Quarto ${number}$`) }) });
}

export function snackbar(page: Page): Locator {
  return page.locator('mat-snack-bar-container');
}

/** Data no formato do datepicker (locale padrão da aplicação: en-US, MM/DD/YYYY). */
export function pickerDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${month}/${day}/${year}`;
}
