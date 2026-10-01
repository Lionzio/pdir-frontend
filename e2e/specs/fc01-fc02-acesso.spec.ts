import { expect, test } from '@playwright/test';

import { E2E_EMAIL_DOMAIN, uid } from '../support/api';
import { login, loginAndWaitForRooms, logout } from '../support/ui';

test.describe('FC1 · Login', () => {
  test('@smoke DONO semeado entra e cai no mapa de quartos', async ({ page }) => {
    await loginAndWaitForRooms(page);
  });

  test('rota protegida sem sessão vai para /login', async ({ page }) => {
    await page.goto('/admin/reservations');
    await expect(page).toHaveURL(/\/login/);
  });

  test('credencial errada mostra erro e não entra', async ({ page }) => {
    await login(page, 'admin.e2e@pdir.test', 'senha-errada');
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos');
    await expect(page).toHaveURL(/\/login/);
  });
});

test('FC2 · cadastro → login negado → aprovação pela tela → login aceito', async ({ page }) => {
  const email = `cadastro.${uid()}@${E2E_EMAIL_DOMAIN}`;
  const password = `senha-e2e-${uid()}`;
  const name = `Funcionária Nova ${uid()}`;

  await page.goto('/login');
  await page.getByRole('tab', { name: 'Solicitar Acesso' }).click();
  await page.locator('#reg-fullname').fill(name);
  await page.locator('#reg-email').fill(email);
  await page.locator('#reg-password').fill(password);
  await page.locator('#btn-register').click();
  await expect(page.getByRole('status')).toBeVisible();

  await page.getByRole('tab', { name: 'Entrar' }).click();
  await login(page, email, password);
  await expect(page.getByRole('alert')).toContainText('sob análise');

  await loginAndWaitForRooms(page);
  await page.goto('/admin/approvals');
  const row = page.locator('.pending-item').filter({ hasText: email });
  await row.getByRole('button', { name: 'Aprovar' }).click();
  await expect(row).toHaveCount(0);
  await logout(page);

  await loginAndWaitForRooms(page, email, password);
});
