import { expect, test } from '@playwright/test';

import { Api } from '../support/api';
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
