import { TestBed } from '@angular/core/testing';
import { AuthSignalService } from './auth-signal.service';
import { AuthStorageService } from './auth-storage.service';
import { PLATFORM_ID } from '@angular/core';

describe('AuthSignalService', () => {
  let service: AuthSignalService;
  let storageServiceSpy: jasmine.SpyObj<AuthStorageService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AuthStorageService', [
      'getSession',
      'saveSession',
      'clearSession',
      'getStorageKey',
    ]);

    TestBed.configureTestingModule({
      providers: [
        AuthSignalService,
        { provide: AuthStorageService, useValue: spy },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(AuthSignalService);
    storageServiceSpy = TestBed.inject(AuthStorageService) as jasmine.SpyObj<AuthStorageService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should update session and call storage', () => {
    const payload = { sub: 'test@test.com', role: 'admin', permissions: ['all'] };
    service.updateSession('token123', payload);

    expect(service.accessToken()).toBe('token123');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.role()).toBe('admin');
    expect(service.permissions()).toEqual(['all']);
    expect(storageServiceSpy.saveSession).toHaveBeenCalledWith({ token: 'token123', payload });
  });

  it('should clear session and call storage', () => {
    service.clearSession();

    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
    expect(storageServiceSpy.clearSession).toHaveBeenCalled();
  });

  it('should check permissions correctly', () => {
    service.updateSession('token123', {
      sub: 'test',
      role: 'user',
      permissions: ['read', 'write'],
    });
    expect(service.hasPermission('read')).toBeTrue();
    expect(service.hasPermission('delete')).toBeFalse();

    service.updateSession('token123', { sub: 'test', role: 'admin', permissions: ['all'] });
    expect(service.hasPermission('delete')).toBeTrue();
  });

  it('should initialize session successfully with valid token', async () => {
    // Creating a mock JWT token that does not expire for the test
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    // Token expires in 1 hour
    const payload = btoa(
      JSON.stringify({ sub: 'test', exp: Math.floor(Date.now() / 1000) + 3600 }),
    );
    const signature = 'fake-signature';
    const validToken = `${header}.${payload}.${signature}`;

    storageServiceSpy.getSession.and.returnValue({
      token: validToken,
      payload: { sub: 'test@test.com', role: 'user', permissions: [] },
    });

    await service.initializeSession();

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.accessToken()).toBe(validToken);
  });

  it('should clear session if initialized with expired token', async () => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    // Token expired 1 hour ago
    const payload = btoa(
      JSON.stringify({ sub: 'test', exp: Math.floor(Date.now() / 1000) - 3600 }),
    );
    const signature = 'fake-signature';
    const expiredToken = `${header}.${payload}.${signature}`;

    storageServiceSpy.getSession.and.returnValue({
      token: expiredToken,
      payload: { sub: 'test@test.com', role: 'user', permissions: [] },
    });

    await service.initializeSession();

    expect(service.isAuthenticated()).toBeFalse();
    expect(storageServiceSpy.clearSession).toHaveBeenCalled();
  });
});
