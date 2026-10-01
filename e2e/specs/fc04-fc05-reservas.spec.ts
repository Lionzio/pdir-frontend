import { Page, expect, test } from '@playwright/test';

import { Api, fakeCpf, hotelDate, uid } from '../support/api';
import { loginAndWaitForRooms, pickerDate, snackbar } from '../support/ui';

async function fillReservation(
  page: Page,
  roomId: number,
  checkIn: string,
  checkOut: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Próximo' }).click();
  await page.getByLabel('Check-in').fill(pickerDate(checkIn));
  await page.getByLabel('Check-out').fill(pickerDate(checkOut));
  await page.getByLabel('Quarto (ID)').fill(String(roomId));
  await page.getByRole('button', { name: 'Confirmar Reserva' }).click();
}

test('FC4 · nova reserva com hóspede existente aparece na timeline', async ({ page }) => {
  const api = await Api.login();
  const room = await api.room('21');
  const cpf = fakeCpf();
  const guest = `Hóspede FC4 ${uid()}`;
  // Hóspede já cadastrado por uma reserva anterior, em outro mês
  await api.json(
    'post',
    'reservations',
    {
      room_id: room.id,
      guest_cpf: cpf,
      guest_full_name: guest,
      check_in: hotelDate(90),
      check_out: hotelDate(91),
    },
    201,
  );

  await loginAndWaitForRooms(page);
  await page.goto('/admin/reservations/new');
  await page.getByLabel('CPF').fill(cpf);
  await expect(page.locator('.guest-card')).toContainText(`Hóspede Localizado: ${guest}`);

  await fillReservation(page, room.id, hotelDate(0), hotelDate(1));
  await expect(snackbar(page)).toContainText('Reserva criada com sucesso!');

  await page.goto('/admin/reservations');
  await expect(page.locator('.reservation-pill', { hasText: guest }).first()).toBeVisible();
  await api.dispose();
});

test('FC5 · overbooking: reserva sobreposta mostra erro e não cria nada', async ({ page }) => {
  const api = await Api.login();
  const room = await api.room('22');
  await api.json(
    'post',
    'reservations',
    {
      room_id: room.id,
      guest_cpf: fakeCpf(),
      guest_full_name: `Hóspede FC5 ${uid()}`,
      check_in: hotelDate(60),
      check_out: hotelDate(63),
    },
    201,
  );
  const before = (await api.reservations(hotelDate(60), hotelDate(63))).filter(
    (r) => r.room_id === room.id,
  );

  await loginAndWaitForRooms(page);
  await page.goto('/admin/reservations/new');
  await page.getByLabel('CPF').fill(fakeCpf());
  await page.getByLabel('Nome completo').fill(`Outro Hóspede ${uid()}`);
  await fillReservation(page, room.id, hotelDate(61), hotelDate(62));

  await expect(snackbar(page)).toContainText('Overbooking');
  const after = (await api.reservations(hotelDate(60), hotelDate(63))).filter(
    (r) => r.room_id === room.id,
  );
  expect(after).toHaveLength(before.length);
  await api.dispose();
});
