import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { AuthSignalService } from '../services/auth-signal.service';
import { roleGuard } from './role.guard';

describe('roleGuard (T-34)', () => {
  let router: jasmine.SpyObj<Router>;
  let auth: jasmine.SpyObj<AuthSignalService>;
  const run = (roles: string[]) =>
    TestBed.runInInjectionContext(() =>
      roleGuard(roles)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['parseUrl']);
    router.parseUrl.and.callFake((url: string) => ({ url }) as unknown as UrlTree);
    auth = jasmine.createSpyObj('AuthSignalService', ['isAuthenticated', 'hasRole']);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthSignalService, useValue: auth },
      ],
    });
  });

  it('recepcionista não acessa /admin/sync (vai para o mapa de quartos)', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.hasRole.and.callFake((roles: string[]) => roles.includes('RECEPCIONISTA'));
    expect(run(['DONO', 'GERENTE'])).toEqual({ url: '/admin/rooms' } as unknown as UrlTree);
  });

  it('gerente acessa a tela de gestão', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.hasRole.and.callFake((roles: string[]) => roles.includes('GERENTE'));
    expect(run(['DONO', 'GERENTE'])).toBeTrue();
  });

  it('sem sessão vai para /login', () => {
    auth.isAuthenticated.and.returnValue(false);
    expect(run(['DONO', 'GERENTE'])).toEqual({ url: '/login' } as unknown as UrlTree);
  });
});
