/**
 * Configuração do build de produção (padrão do `ng build`) — T-36.
 *
 * `apiBaseUrl` é a raiz da API. O padrão `/api/v1` supõe frontend e API na mesma origem (reverse
 * proxy). Para uma API em outro host, use a URL absoluta, ex.: 'https://api.hotel.example/api/v1'.
 * O host precisa estar em CORS_ALLOWED_ORIGINS do backend e ser do mesmo site do frontend, porque o
 * cookie do refresh token é SameSite=Strict.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
};
