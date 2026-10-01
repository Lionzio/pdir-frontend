import {
  HttpClient,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';

import { AuthSignalService } from '../services/auth-signal.service';
import { API_BASE_URL } from '../../core/config/api.config';

// Rotas de autenticação nunca disparam refresh: um 401 nelas é a resposta final (T-30, H18).
// Antes, um 401 no próprio /auth/refresh caía na fila de espera, que nunca emitia, e a tela travava.
const AUTH_ENDPOINTS = ['/auth/token', '/auth/refresh', '/auth/logout', '/auth/register'];

// Refresh em andamento, compartilhado por todas as requisições que receberem 401 ao mesmo tempo:
// um único POST /auth/refresh, e sucesso ou falha chegam a todas.
let refreshInFlight$: Observable<string> | null = null;

function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

function refreshAccessToken(
  apiBaseUrl: string,
  http: HttpClient,
  authService: AuthSignalService,
  router: Router,
): Observable<string> {
  if (!refreshInFlight$) {
    refreshInFlight$ = http
      .post<{ access_token: string }>(`${apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        map((res) => {
          // Valida os claims mínimos necessários (TSK-003); não reconstrói sessão vazia/mockada
          if (!authService.applyAccessToken(res.access_token)) {
            throw new Error('Refresh token não contém claims obrigatórios');
          }
          return res.access_token;
        }),
        catchError((refreshErr: unknown) => {
          // Sessão expirada de vez: limpa e manda para o login (fluxo FC10)
          authService.clearSession();
          void router.navigateByUrl('/login').catch(() => undefined);
          return throwError(() => refreshErr);
        }),
        finalize(() => {
          refreshInFlight$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
  }
  return refreshInFlight$;
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthSignalService);
  const http = inject(HttpClient);
  const router = inject(Router);
  const apiBaseUrl = inject(API_BASE_URL);
  const token = authService.accessToken();

  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        isAuthEndpoint(req.url)
      ) {
        return throwError(() => error);
      }
      return refreshAccessToken(apiBaseUrl, http, authService, router).pipe(
        switchMap((newToken) =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })),
        ),
      );
    }),
  );
};
