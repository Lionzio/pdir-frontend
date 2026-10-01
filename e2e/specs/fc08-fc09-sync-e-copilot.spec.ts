import { expect, test } from '@playwright/test';

import { Api } from '../support/api';
import { loginAndWaitForRooms, snackbar } from '../support/ui';

test('FC8 · sincronização: DONO dispara; recepcionista não acessa o painel', async ({ page }) => {
  await loginAndWaitForRooms(page);
  await page.goto('/admin/sync');
  await page.getByRole('button', { name: /Forçar Sincronização/ }).click();
  await expect(snackbar(page)).toContainText('Sincronização');
  await page.getByRole('button', { name: 'Sair' }).click();

  const api = await Api.login();
  const recepcao = await api.staff('RECEPCIONISTA');
  await loginAndWaitForRooms(page, recepcao.email, recepcao.password);
  await page.goto('/admin/sync');
  await expect(page).toHaveURL(/\/admin\/rooms/);
  await api.dispose();
});

test.describe('FC9 · Copilot', () => {
  test('sem chave de IA mostra erro amigável', async ({ page }) => {
    await loginAndWaitForRooms(page);
    await page.locator('button.fab').click();
    await page.getByPlaceholder('Digite sua mensagem...').fill('Quais quartos estão livres hoje?');
    await page.getByPlaceholder('Digite sua mensagem...').press('Enter');
    await expect(page.getByText(/AI não configurada/)).toBeVisible();
  });

  test('com LLM falso, a resposta em streaming aparece inteira', async ({ page }) => {
    // O backend E2E não tem chave de IA: o stream é simulado na rede para validar a renderização
    const frame = (payload: object) => `data: ${JSON.stringify(payload)}\n\n`;
    await page.route('**/api/v1/intelligence/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body:
          frame({ event: 'message_start' }) +
          frame({ event: 'tool_start', name: 'check_room_availability' }) +
          frame({ event: 'tool_end', name: 'check_room_availability' }) +
          frame({ event: 'text_delta', data: 'Os quartos 101 e ' }) +
          frame({ event: 'text_delta', data: '102 estão livres.' }) +
          frame({ event: 'message_complete' }),
      }),
    );

    await loginAndWaitForRooms(page);
    await page.locator('button.fab').click();
    await page.getByPlaceholder('Digite sua mensagem...').fill('Quais quartos estão livres?');
    await page.getByPlaceholder('Digite sua mensagem...').press('Enter');
    await expect(page.getByText('Os quartos 101 e 102 estão livres.')).toBeVisible();
  });
});
