import { expect, test } from '@playwright/test';

import { Api, fakeCpf, hotelDate, uid } from '../support/api';
import { loginAndWaitForRooms, logout, pickerDate, snackbar } from '../support/ui';

/** Smoke (@smoke): o caminho mínimo que precisa funcionar em todo PR — login, mapa, nova reserva, logout. */
test('@smoke login, mapa de quartos, nova reserva e logout', async ({ page }) => {
  const api = await Api.login();
  const room = await api.room('20');
  const guest = `Hóspede Smoke ${uid()}`;

  await loginAndWaitForRooms(page);

  await page.goto('/admin/reservations/new');
  await page.getByLabel('CPF').fill(fakeCpf());
  await page.getByLabel('Nome completo').fill(guest);
  await page.getByRole('button', { name: 'Próximo' }).click();
  await page.getByLabel('Check-in').fill(pickerDate(hotelDate(40)));
  await page.getByLabel('Check-out').fill(pickerDate(hotelDate(41)));
  await page.getByLabel('Quarto (ID)').fill(String(room.id));
  await page.getByRole('button', { name: 'Confirmar Reserva' }).click();

  await expect(snackbar(page)).toContainText('Reserva criada com sucesso!');
  await expect(page).toHaveURL(/\/admin\/rooms/);
  const created = await api.reservations(hotelDate(40), hotelDate(41));
  expect(created.some((r) => r.room_id === room.id)).toBeTruthy();

  await logout(page);
  await api.dispose();
});
