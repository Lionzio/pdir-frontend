import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AuthSignalService } from './core/services/auth-signal.service';

describe('AppComponent — Copilot só para usuário autenticado (T-31)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    TestBed.inject(AuthSignalService).clearSession();
  });

  it('não mostra o widget sem sessão (tela de login)', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-chat-widget')).toBeNull();
  });

  it('mostra o widget com sessão ativa', () => {
    TestBed.inject(AuthSignalService).updateSession('token', {
      sub: 'gerente@exemplo.test',
      user_id: 7,
      role: 'GERENTE',
      permissions: [],
    });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-chat-widget')).not.toBeNull();
  });
});
