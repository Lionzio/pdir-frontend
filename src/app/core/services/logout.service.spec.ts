import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthSignalService } from './auth-signal.service';
import { LogoutService } from './logout.service';

describe('LogoutService (T-38)', () => {
  let service: LogoutService;
  let auth: AuthSignalService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(LogoutService);
    auth = TestBed.inject(AuthSignalService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    auth.updateSession('token-ativo', {
      sub: 'recepcao@exemplo.test',
      user_id: 3,
      role: 'RECEPCIONISTA',
      permissions: [],
    });
  });

  afterEach(() => http.verify());

  it('revoga no backend com o token, limpa a sessão e vai para /login', async () => {
    const done = service.logout();
    const req = http.expectOne('/api/v1/auth/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-ativo');
    req.flush({ message: 'ok' });
    await done;

    expect(auth.isAuthenticated()).toBeFalse();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('limpa a sessão mesmo se a revogação falhar', async () => {
    const done = service.logout();
    http.expectOne('/api/v1/auth/logout').error(new ProgressEvent('network'));
    await done;

    expect(auth.isAuthenticated()).toBeFalse();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    http.expectNone('/api/v1/auth/refresh');
  });
});
