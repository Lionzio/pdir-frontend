import { expect, test } from '@playwright/test';

import { Api } from '../support/api';
import { FRONTEND_URL } from '../support/env';
import { loginAndWaitForRooms, roomCard, roomCards } from '../support/ui';

test('FC3 · mapa com 27 quartos e mudança de status refletida em outra página via SSE', async ({
  page,
  context,
}) => {
  const api = await Api.login();
  await api.setRoomStatus('5', 'AVAILABLE');

  await loginAndWaitForRooms(page);
  await expect(roomCards(page)).toHaveCount(27);

  // Segunda página da mesma sessão (o cookie do refresh restaura a sessão sem novo login)
  const observer = await context.newPage();
  await observer.goto('/admin/rooms');
  await expect(roomCard(observer, '5')).toContainText('Disponível');

  await roomCard(page, '5')
    .getByRole('button', { name: /Status/ })
    .click();
  await page.getByRole('button', { name: /Manutenção/ }).click();

  await expect(roomCard(observer, '5')).toContainText('Manutenção');
  await api.setRoomStatus('5', 'AVAILABLE');
  await api.dispose();
});

test('FC3 · a CAMAREIRA vê o mapa e libera um quarto limpo; a gestão vê a mudança via SSE (T-52)', async ({
  page,
  browser,
}) => {
  const api = await Api.login();
  await api.setRoomStatus('7', 'CLEANING');
  const camareira = await api.staff('CAMAREIRA');

  await loginAndWaitForRooms(page, camareira.email, camareira.password);
  await expect(roomCards(page)).toHaveCount(27);
  await expect(page.getByRole('button', { name: /Grade de Reservas/ })).toHaveCount(0);

  // O DONO acompanha o mapa em outra sessão
  const ownerContext = await browser.newContext({ baseURL: FRONTEND_URL });
  const observer = await ownerContext.newPage();
  await loginAndWaitForRooms(observer);
  await expect(roomCard(observer, '7')).toContainText('Limpeza');

  await roomCard(page, '7')
    .getByRole('button', { name: /Status/ })
    .click();
  await page.getByRole('button', { name: /Disponibilizar/ }).click();

  await expect(roomCard(observer, '7')).toContainText('Disponível');
  await ownerContext.close();
  await api.setRoomStatus('7', 'AVAILABLE');
  await api.dispose();
});
