import { expect, test } from '@playwright/test';

import { Api, fakeCpf, hotelDate, uid } from '../support/api';
import { loginAndWaitForRooms, roomCard, snackbar } from '../support/ui';

test('FC6 · check-in e check-out pela timeline refletem no mapa de quartos', async ({ page }) => {
  const api = await Api.login();
  await api.setRoomStatus('23', 'AVAILABLE');
  const room = await api.room('23');
  const guest = `Hóspede FC6 ${uid()}`;
  await api.json(
    'post',
    'reservations',
    {
      room_id: room.id,
      guest_cpf: fakeCpf(),
      guest_full_name: guest,
      check_in: hotelDate(0),
      check_out: hotelDate(2),
    },
    201,
  );

  await loginAndWaitForRooms(page);
  await page.goto('/admin/reservations');
  await page.locator('.reservation-pill', { hasText: guest }).first().click();
  await page.getByRole('button', { name: /Fazer check-in/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Hospedado');
  await page.getByRole('button', { name: 'Fechar' }).click();

  await page.goto('/admin/rooms');
  await expect(roomCard(page, '23')).toContainText('Ocupado');

  await page.goto('/admin/reservations');
  await page.locator('.reservation-pill', { hasText: guest }).first().click();
  await page.getByRole('button', { name: /Fazer check-out/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Check-out feito');
  await page.getByRole('button', { name: 'Fechar' }).click();

  await page.goto('/admin/rooms');
  await expect(roomCard(page, '23')).toContainText('Limpeza');
  await api.setRoomStatus('23', 'AVAILABLE');
  await api.dispose();
});

test('FC7 · conta: débito, pagamento parcial, fechamento bloqueado, quitação e estorno só para o DONO', async ({
  page,
}) => {
  const api = await Api.login();
  await api.setRoomStatus('24', 'AVAILABLE');
  const room = await api.room('24');
  const guest = `Hóspede FC7 ${uid()}`;
  const reservation = await api.json<{ id: number }>(
    'post',
    'reservations',
    {
      room_id: room.id,
      guest_cpf: fakeCpf(),
      guest_full_name: guest,
      check_in: hotelDate(0),
      check_out: hotelDate(1),
    },
    201,
  );
  await api.json('post', `reservations/${reservation.id}/check-in`); // abre a conta (T-22)

  await loginAndWaitForRooms(page);
  await page.goto('/admin/finance');
  const card = page.locator('mat-card').filter({ hasText: `Reserva #${reservation.id}` });

  // Débito de consumo
  await card.getByRole('button', { name: /Lançar/ }).click();
  await page.getByLabel('Valor (R$)').fill('100');
  await page.getByLabel('Descrição').fill('Frigobar E2E');
  await page.locator('form').getByRole('button', { name: 'Lançar' }).click();
  await expect(snackbar(page)).toBeVisible();

  // Pagamento parcial
  await card.getByRole('button', { name: /Lançar/ }).click();
  await page.getByLabel('Tipo').click();
  await page.getByRole('option', { name: /Crédito/ }).click();
  await page.getByLabel('Valor (R$)').fill('40');
  await page.getByLabel('Descrição').fill('Adiantamento E2E');
  await page.locator('form').getByRole('button', { name: 'Lançar' }).click();
  await expect(snackbar(page)).toBeVisible();

  // Extrato: saldo de 60; fechar com menos que o saldo fica bloqueado
  await card.getByRole('button', { name: /Extrato/ }).click();
  await expect(page.locator('.checkout-section')).toContainText('60');
  await expect(page.getByRole('button', { name: 'Estornar transação' }).first()).toBeVisible(); // só o DONO vê
  const payment = page.getByLabel('Valor Recebido do Hóspede (R$)');
  await payment.fill('30');
  await expect(page.getByRole('button', { name: 'Fechar Conta' })).toBeDisabled();
  await payment.fill('60');
  await page.getByRole('button', { name: 'Fechar Conta' }).click();
  await expect(card).toContainText('Encerrada');

  // Recepção não chega ao financeiro (o estorno some para quem não é DONO: spec da diretiva RBAC).
  // Não há como criar GERENTE pela API (o autocadastro só aceita cargos operacionais, T-15).
  const recepcao = await api.staff('RECEPCIONISTA');
  await page.getByRole('button', { name: 'Sair' }).click();
  await loginAndWaitForRooms(page, recepcao.email, recepcao.password);
  await page.goto('/admin/finance');
  await expect(page).toHaveURL(/\/admin\/rooms/);
  await api.dispose();
});
