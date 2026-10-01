import { expect, test } from '@playwright/test';

import { E2E } from '../support/env';
import { loginAndWaitForRooms, roomCards } from '../support/ui';

/**
 * FC10 · Sessão: o access token da pilha E2E vive 1 minuto (ACCESS_TOKEN_EXPIRE_MINUTES=1).
 * Depois de expirar, a navegação continua via refresh; sem o cookie do refresh, a sessão é limpa e vai para /login.
 * Cenário lento (espera a expiração real), por isso fica fora do smoke.
 */
test('FC10 · token expirado renova pelo refresh; refresh inválido limpa a sessão', async ({
  page,
  context,
}) => {
  test.slow();
  const expiry = (E2E.accessTokenMinutes * 60 + 5) * 1000;

  await loginAndWaitForRooms(page);

  // 1. Token expirado: a próxima chamada recebe 401, o interceptor renova e a tela carrega
  await page.waitForTimeout(expiry);
  const refreshed = page.waitForResponse(
    (r) => r.url().includes('/auth/refresh') && r.status() === 200,
  );
  await page.getByRole('button', { name: /Grade de Reservas/ }).click();
  await refreshed;
  await expect(page).toHaveURL(/\/admin\/reservations/);
  await expect(page.getByRole('heading', { name: 'Reservas' })).toBeVisible();

  // 2. Sem o cookie do refresh: na expiração seguinte, a sessão é limpa e o usuário volta ao login
  await context.clearCookies();
  await page.waitForTimeout(expiry);
  await page.getByRole('button', { name: /Matriz de Quartos/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(roomCards(page)).toHaveCount(0);
});
