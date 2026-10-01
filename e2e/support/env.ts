/**
 * Configuração da pilha E2E (T-45). Tudo tem padrão de teste e pode ser sobrescrito por variável de ambiente.
 * Nenhum valor aqui é credencial real: o banco é descartável e o admin é criado pelo seed do backend.
 */
export const E2E = {
  frontendPort: Number(process.env['E2E_FRONTEND_PORT'] ?? 4300),
  backendPort: Number(process.env['E2E_BACKEND_PORT'] ?? 8001),
  adminEmail: process.env['E2E_ADMIN_EMAIL'] ?? 'admin.e2e@pdir.test',
  adminPassword: process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-senha-local',
  /** Vida do access token na pilha E2E: curta, para o FC10 exercitar o refresh de verdade. */
  accessTokenMinutes: Number(process.env['E2E_ACCESS_TOKEN_MINUTES'] ?? 1),
};

export const FRONTEND_URL = `http://localhost:${E2E.frontendPort}`;
export const API_URL = `http://127.0.0.1:${E2E.backendPort}/api/v1`;
