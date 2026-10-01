import { defineConfig, devices } from '@playwright/test';

import { E2E, FRONTEND_URL } from './support/env';

/**
 * E2E dos fluxos críticos FC1–FC10 (T-45), com frontend e backend reais contra um banco descartável.
 *
 * - `npm run e2e`        → suíte completa (FC1–FC10 + smoke)
 * - `npm run e2e:smoke`  → só os cenários marcados com @smoke (login, mapa, nova reserva, logout)
 *
 * Os testes rodam em série (workers: 1): compartilham o banco semeado, e cada cenário usa os próprios
 * quartos e datas para não interferir nos outros.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : [['list']],
  outputDir: '../test-results',
  use: {
    baseURL: FRONTEND_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/scripts/start-backend.mjs',
      cwd: '..',
      url: `http://127.0.0.1:${E2E.backendPort}/readyz`,
      timeout: 180_000,
      reuseExistingServer: !process.env['CI'],
      // Log da API só com E2E_DEBUG=1 (o access log polui a saída dos testes)
      stdout: process.env['E2E_DEBUG'] ? 'pipe' : 'ignore',
      stderr: process.env['E2E_DEBUG'] ? 'pipe' : 'ignore',
    },
    {
      command: `npx ng serve --port ${E2E.frontendPort} --proxy-config e2e/proxy.e2e.json`,
      cwd: '..',
      url: FRONTEND_URL,
      timeout: 240_000,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
