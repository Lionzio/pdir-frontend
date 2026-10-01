import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Raiz da API (T-36). Vem do arquivo de environment do build; os testes podem sobrescrever.
 * Sem barra no final: os serviços montam `${base}/recurso`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl.replace(/\/+$/, ''),
});
