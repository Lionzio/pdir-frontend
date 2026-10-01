import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthSignalService } from './auth-signal.service';

function jwt(payload: Record<string, unknown>): string {
  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.assinatura`;
}

describe('AuthSignalService', () => {
  let service: AuthSignalService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(AuthSignalService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    service.clearSession();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('mantém a sessão só em memória: nada vai para o localStorage (T-19)', () => {
    const payload = { sub: 'test@test.com', user_id: 1, role: 'GERENTE', permissions: ['all'] };
    service.updateSession('token-secreto-123', payload);

    expect(service.accessToken()).toBe('token-secreto-123');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.userId()).toBe(1);
    expect(service.role()).toBe('GERENTE');
    expect(service.permissions()).toEqual(['all']);

    const stored = Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? '');
    expect(stored.some((value) => value.includes('token-secreto-123'))).toBeFalse();
    expect(sessionStorage.length).toBe(0);
  });

  it('should clear session', () => {
    service.updateSession('token123', { sub: 'a', user_id: 1, role: 'DONO', permissions: [] });
    service.clearSession();

    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.userId()).toBeNull();
  });

  it('should check permissions correctly', () => {
    service.updateSession('token123', {
      sub: 'test',
      user_id: 1,
      role: 'user',
      permissions: ['read', 'write'],
    });
    expect(service.hasPermission('read')).toBeTrue();
    expect(service.hasPermission('delete')).toBeFalse();
  });

  it('should return true from hasRole when current role is in the allowed list', () => {
    service.updateSession('t', { sub: 'a', user_id: 1, role: 'GERENTE', permissions: [] });
    expect(service.hasRole(['DONO', 'GERENTE'])).toBeTrue();
  });

  it('should return false from hasRole when current role is not in the allowed list', () => {
    service.updateSession('t', { sub: 'a', user_id: 1, role: 'CAMAREIRA', permissions: [] });
    expect(service.hasRole(['DONO', 'GERENTE'])).toBeFalse();
  });

  it('should return true from hasRole when allowedRoles contains "all" and user has any role', () => {
    service.updateSession('t', { sub: 'a', user_id: 1, role: 'CAMAREIRA', permissions: [] });
    expect(service.hasRole(['all'])).toBeTrue();
  });

  it('should return false from hasRole when role is null (fail-closed)', () => {
    expect(service.hasRole(['DONO', 'GERENTE', 'all'])).toBeFalse();
  });

  describe('restauração da sessão no boot (T-19)', () => {
    it('restaura pelo cookie HttpOnly do refresh', async () => {
      const token = jwt({ sub: 'gerente@exemplo.test', user_id: 7, role: 'GERENTE' });
      const done = service.initializeSession();

      const req = http.expectOne('/api/v1/auth/refresh');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ access_token: token, token_type: 'bearer' });
      await done;

      expect(service.isAuthenticated()).toBeTrue();
      expect(service.accessToken()).toBe(token);
      expect(service.role()).toBe('GERENTE');
    });

    it('sem cookie válido (401), segue deslogado', async () => {
      const done = service.initializeSession();
      http
        .expectOne('/api/v1/auth/refresh')
        .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
      await done;

      expect(service.isAuthenticated()).toBeFalse();
    });

    it('token sem os claims obrigatórios não cria sessão', async () => {
      const done = service.initializeSession();
      http.expectOne('/api/v1/auth/refresh').flush({ access_token: jwt({ sub: 'x' }) });
      await done;

      expect(service.isAuthenticated()).toBeFalse();
    });
  });
});
