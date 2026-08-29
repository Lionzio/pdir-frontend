import { TestBed } from '@angular/core/testing';
import { AuthStorageService, StoredSession } from './auth-storage.service';
import { PLATFORM_ID } from '@angular/core';

describe('AuthStorageService', () => {
  let service: AuthStorageService;

  const mockSession: StoredSession = {
    token: 'fake-jwt-token',
    payload: { sub: 'test@test.com', user_id: 1, role: 'admin', permissions: ['all'] },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthStorageService, { provide: PLATFORM_ID, useValue: 'browser' }],
    });
    service = TestBed.inject(AuthStorageService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should save session to localStorage', () => {
    service.saveSession(mockSession);
    const stored = localStorage.getItem(service.getStorageKey());
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual(mockSession);
  });

  it('should get session from localStorage', () => {
    localStorage.setItem(service.getStorageKey(), JSON.stringify(mockSession));
    const session = service.getSession();
    expect(session).toEqual(mockSession);
  });

  it('should return null if no session in localStorage', () => {
    const session = service.getSession();
    expect(session).toBeNull();
  });

  it('should clear session from localStorage', () => {
    localStorage.setItem(service.getStorageKey(), JSON.stringify(mockSession));
    service.clearSession();
    const stored = localStorage.getItem(service.getStorageKey());
    expect(stored).toBeNull();
  });

  it('should handle corrupted data gracefully and return null', () => {
    localStorage.setItem(service.getStorageKey(), '{corrupted-json');
    const session = service.getSession();
    expect(session).toBeNull();
    // It should also clear the corrupted data
    expect(localStorage.getItem(service.getStorageKey())).toBeNull();
  });
});
