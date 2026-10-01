import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';
import { AuthSignalService } from '../services/auth-signal.service';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';

function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadBase64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const signature = 'fake-signature';
  return `${header}.${payloadBase64}.${signature}`;
}

describe('AuthInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let authService: AuthSignalService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthSignalService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    authService = TestBed.inject(AuthSignalService);

    authService.clearSession();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('Cenário 1 - Refresh com role RECEPCIONISTA (sem mock de Dono)', () => {
    authService.updateSession('expired-token', {
      sub: 'antigo',
      user_id: 1,
      role: 'RECEPCIONISTA',
      permissions: [],
    });

    httpClient.get('/api/protected').subscribe();

    const req1 = httpMock.expectOne('/api/protected');
    req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');
    expect(refreshReq.request.method).toBe('POST');

    const novoPayload = {
      sub: 'usuario@example.com',
      user_id: 99,
      role: 'RECEPCIONISTA',
      permissions: ['manage'],
    };
    const novoToken = createMockJwt(novoPayload);

    refreshReq.flush({ access_token: novoToken });

    const req2 = httpMock.expectOne('/api/protected');
    expect(req2.request.headers.get('Authorization')).toBe(`Bearer ${novoToken}`);
    req2.flush({ data: 'ok' });

    expect(authService.role()).toBe('RECEPCIONISTA');
    expect(authService.userId()).toBe(99);
    expect(authService.accessToken()).toBe(novoToken);
  });

  it('Cenário 2 - Refresh com role DONO', () => {
    authService.updateSession('expired-token', {
      sub: 'antigo',
      user_id: 1,
      role: 'DONO',
      permissions: [],
    });

    httpClient.get('/api/protected').subscribe();
    httpMock
      .expectOne('/api/protected')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const novoToken = createMockJwt({ sub: 'dono@example.com', user_id: 1, role: 'DONO' });
    httpMock.expectOne('/api/v1/auth/refresh').flush({ access_token: novoToken });

    httpMock.expectOne('/api/protected').flush({ data: 'ok' });
    expect(authService.role()).toBe('DONO');
  });

  it('Cenário 3 - Refresh com role diferente do hardcode anterior (CAMAREIRA)', () => {
    authService.updateSession('expired-token', {
      sub: 'antigo',
      user_id: 1,
      role: 'CAMAREIRA',
      permissions: [],
    });

    httpClient.get('/api/protected').subscribe();
    httpMock
      .expectOne('/api/protected')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const novoToken = createMockJwt({
      sub: 'camareira@example.com',
      user_id: 5,
      role: 'CAMAREIRA',
    });
    httpMock.expectOne('/api/v1/auth/refresh').flush({ access_token: novoToken });

    httpMock.expectOne('/api/protected').flush({ data: 'ok' });
    expect(authService.role()).toBe('CAMAREIRA');
  });

  it('Cenário 4 - sub e user_id', () => {
    authService.updateSession('expired-token', {
      sub: 'antigo',
      user_id: 1,
      role: 'GERENTE',
      permissions: [],
    });

    httpClient.get('/api/protected').subscribe();
    httpMock
      .expectOne('/api/protected')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const novoToken = createMockJwt({
      sub: 'novo-sub@example.com',
      user_id: 1001,
      role: 'GERENTE',
    });
    httpMock.expectOne('/api/v1/auth/refresh').flush({ access_token: novoToken });

    httpMock.expectOne('/api/protected').flush({ data: 'ok' });

    expect(authService.email()).toBe('novo-sub@example.com');
    expect(authService.userId()).toBe(1001);
  });

  it('Cenário 5 - Claim obrigatorio ausente', () => {
    authService.updateSession('expired-token', {
      sub: 'antigo',
      user_id: 1,
      role: 'GERENTE',
      permissions: [],
    });

    let error: unknown;
    httpClient.get('/api/protected').subscribe({
      error: (e) => (error = e),
    });

    httpMock
      .expectOne('/api/protected')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const invalidToken = createMockJwt({ sub: 'teste' });
    httpMock.expectOne('/api/v1/auth/refresh').flush({ access_token: invalidToken });

    httpMock.expectNone('/api/protected');

    expect(authService.isAuthenticated()).toBeFalse();
    expect(authService.role()).toBeNull();

    expect((error as Error).message).toBe('Refresh token não contém claims obrigatórios');
  });

  it('Cenário 6 - JWT malformado', () => {
    authService.updateSession('expired-token', {
      sub: 'antigo',
      user_id: 1,
      role: 'GERENTE',
      permissions: [],
    });

    let error: unknown;
    httpClient.get('/api/protected').subscribe({
      error: (e) => (error = e),
    });

    httpMock
      .expectOne('/api/protected')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    httpMock.expectOne('/api/v1/auth/refresh').flush({ access_token: 'not-a-valid-jwt' });

    expect(authService.isAuthenticated()).toBeFalse();
    expect((error as Error).message).toBe('Refresh token não contém claims obrigatórios');
  });

  it('Cenário 7 - Preservacao do fluxo HTTP (enqueue and retry)', () => {
    authService.updateSession('expired-token', {
      sub: 'antigo',
      user_id: 1,
      role: 'GERENTE',
      permissions: [],
    });

    httpClient.get('/api/req1').subscribe();
    httpClient.get('/api/req2').subscribe();

    httpMock
      .expectOne('/api/req1')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne('/api/req2')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');

    const novoToken = createMockJwt({ sub: 'user', user_id: 2, role: 'GERENTE' });
    refreshReq.flush({ access_token: novoToken });

    const req1 = httpMock.expectOne('/api/req1');
    const req2 = httpMock.expectOne('/api/req2');

    expect(req1.request.headers.get('Authorization')).toBe(`Bearer ${novoToken}`);
    expect(req2.request.headers.get('Authorization')).toBe(`Bearer ${novoToken}`);

    req1.flush({});
    req2.flush({});
  });
  // T-30 (H18): falha do próprio refresh não pode travar a aplicação
  describe('falha no refresh', () => {
    let router: Router;

    beforeEach(() => {
      router = TestBed.inject(Router);
      spyOn(router, 'navigateByUrl').and.resolveTo(true);
      authService.updateSession('expired-token', {
        sub: 'antigo',
        user_id: 1,
        role: 'GERENTE',
        permissions: [],
      });
    });

    it('Cenário 8 - 401 no /auth/refresh limpa a sessão, vai para /login e devolve o erro', () => {
      let status: number | undefined;
      httpClient.get('/api/protected').subscribe({
        error: (e: HttpErrorResponse) => (status = e.status),
      });

      httpMock
        .expectOne('/api/protected')
        .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
      httpMock
        .expectOne('/api/v1/auth/refresh')
        .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(status).toBe(401);
      expect(authService.isAuthenticated()).toBeFalse();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      httpMock.expectNone('/api/v1/auth/refresh');
      httpMock.expectNone('/api/protected');
    });

    it('Cenário 9 - requisições simultâneas compartilham um único refresh e recebem o erro', () => {
      const errors: number[] = [];
      httpClient
        .get('/api/a')
        .subscribe({ error: (e: HttpErrorResponse) => errors.push(e.status) });
      httpClient
        .get('/api/b')
        .subscribe({ error: (e: HttpErrorResponse) => errors.push(e.status) });

      httpMock.expectOne('/api/a').flush('x', { status: 401, statusText: 'Unauthorized' });
      httpMock.expectOne('/api/b').flush('x', { status: 401, statusText: 'Unauthorized' });
      httpMock
        .expectOne('/api/v1/auth/refresh')
        .flush('x', { status: 401, statusText: 'Unauthorized' });

      expect(errors).toEqual([401, 401]);
      expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
    });

    it('Cenário 10 - 401 no login não dispara refresh', () => {
      let status: number | undefined;
      httpClient.post('/api/v1/auth/token', {}).subscribe({
        error: (e: HttpErrorResponse) => (status = e.status),
      });

      httpMock
        .expectOne('/api/v1/auth/token')
        .flush('Credenciais inválidas', { status: 401, statusText: 'Unauthorized' });

      httpMock.expectNone('/api/v1/auth/refresh');
      expect(status).toBe(401);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
