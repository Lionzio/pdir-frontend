import {
  HttpClient,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';

import { AuthSignalService } from '../services/auth-signal.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthSignalService);
  const http = inject(HttpClient);
  const token = authService.accessToken();

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.url.includes('/auth/token')
      ) {
        // Tratamento de renovação automática com Lock de concorrência
        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return http
            .post<{ access_token: string }>('/api/v1/auth/refresh', {}, { withCredentials: true })
            .pipe(
              switchMap((res) => {
                isRefreshing = false;

                const decoded = authService.decodeTokenPayload(res.access_token);

                // Valida os claims mínimos necessários (TSK-003)
                if (decoded && decoded['sub'] && decoded['user_id'] && decoded['role']) {
                  authService.updateSession(res.access_token, {
                    sub: decoded['sub'] as string,
                    user_id: decoded['user_id'] as number,
                    role: decoded['role'] as string,
                    permissions: (decoded['permissions'] as string[]) || [],
                  });
                  refreshTokenSubject.next(res.access_token);

                  return next(
                    req.clone({
                      setHeaders: { Authorization: `Bearer ${res.access_token}` },
                    }),
                  );
                } else {
                  // Se o token estiver malformado ou sem claims obrigatórios, não reconstrói sessão vazia/mockada
                  authService.clearSession();
                  return throwError(
                    () => new Error('Refresh token não contém claims obrigatórios'),
                  );
                }
              }),
              catchError((refreshErr) => {
                isRefreshing = false;
                authService.clearSession();
                return throwError(() => refreshErr);
              }),
            );
        } else {
          // Enfileira chamadas paralelas enquanto a primeira executa a rotina de refresh
          return refreshTokenSubject.pipe(
            filter((t) => t !== null),
            take(1),
            switchMap((newToken) => {
              return next(
                req.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` },
                }),
              );
            }),
          );
        }
      }
      return throwError(() => error);
    }),
  );
};
