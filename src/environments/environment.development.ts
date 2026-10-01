/**
 * Configuração do `ng serve` (configuração "development" do angular.json) — T-36.
 * Em dev, o proxy do Angular (proxy.conf.json) encaminha /api para http://127.0.0.1:8000.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api/v1',
};
