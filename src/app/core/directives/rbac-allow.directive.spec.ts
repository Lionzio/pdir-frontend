import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';

import { RbacAllowDirective } from './rbac-allow.directive';
import { AuthSignalService } from '../services/auth-signal.service';

// ---------------------------------------------------------------------------
// Componente host minimo para testar a diretiva estrutural
// ---------------------------------------------------------------------------

@Component({
  standalone: true,
  imports: [RbacAllowDirective],
  template: `<div id="protected" *appRbacAllow="allowedRoles">conteudo protegido</div>`,
})
class TestHostComponent {
  allowedRoles: string[] = ['DONO', 'GERENTE'];
}

// ---------------------------------------------------------------------------
// Fabrica de mock do AuthSignalService usando Signals
// ---------------------------------------------------------------------------

function createAuthServiceMock(initialRole: string | null = null): {
  role: () => string | null;
  hasRole: (allowedRoles: string[]) => boolean;
  _setRole: (r: string | null) => void;
} {
  const roleSignal = signal<string | null>(initialRole);

  return {
    role: roleSignal.asReadonly(),
    hasRole: (allowedRoles: string[]): boolean => {
      const currentRole = roleSignal();
      if (!currentRole) return false;
      if (allowedRoles.includes('all')) {
        console.log('HAS_ROLE TRUE FOR ALL');
        return true;
      }
      return allowedRoles.includes(currentRole);
    },
    _setRole: (r: string | null) => roleSignal.set(r),
  };
}

// ---------------------------------------------------------------------------
// Suite de testes
// ---------------------------------------------------------------------------

describe('RbacAllowDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let authMock: ReturnType<typeof createAuthServiceMock>;

  function setup(initialRole: string | null = null, allowedRoles?: string[]): void {
    authMock = createAuthServiceMock(initialRole);

    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: AuthSignalService, useValue: authMock }],
    });

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    if (allowedRoles) {
      host.allowedRoles = allowedRoles;
    }
    fixture.detectChanges();
  }

  function protectedElement(): HTMLElement | null {
    return fixture.nativeElement.querySelector('#protected') as HTMLElement | null;
  }

  // Teste 1 - Role permitido
  it('deve renderizar o template quando o role esta na lista permitida (DONO)', () => {
    setup('DONO');
    expect(protectedElement()).not.toBeNull();
    expect(protectedElement()!.textContent).toContain('conteudo protegido');
  });

  // Teste 2 - Role nao permitido
  it('nao deve renderizar o template quando o role nao esta na lista (CAMAREIRA)', () => {
    setup('CAMAREIRA');
    expect(protectedElement()).toBeNull();
  });

  // Teste 3 - Mudanca reativa: CAMAREIRA -> DONO
  it('deve renderizar o template apos mudanca de role de CAMAREIRA para DONO', async () => {
    setup('CAMAREIRA');
    expect(protectedElement()).toBeNull();

    authMock._setRole('DONO');

    await fixture.whenStable();
    fixture.detectChanges();

    expect(protectedElement()).not.toBeNull();
  });

  // Teste 4 - Logout: DONO -> null
  it('deve remover o template quando o usuario faz logout (role -> null)', async () => {
    setup('DONO');
    expect(protectedElement()).not.toBeNull();

    authMock._setRole(null);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(protectedElement()).toBeNull();
  });

  // Teste 5 - Ausencia de role
  it('deve tratar ausencia de role como nao autorizado', () => {
    setup(null);
    expect(protectedElement()).toBeNull();
  });

  // Teste 6 - Sem duplicacao de EmbeddedView
  it('nao deve criar multiplas EmbeddedViews quando reavaliado com role permitido', async () => {
    setup('DONO');

    authMock._setRole('GERENTE');
    await fixture.whenStable();
    fixture.detectChanges();

    authMock._setRole('DONO');
    await fixture.whenStable();
    fixture.detectChanges();

    const elements = fixture.nativeElement.querySelectorAll('#protected');
    expect(elements.length).toBe(1);
  });

  // Teste 7a - Wildcard 'all' com role presente
  it('deve renderizar quando allowedRoles contem "all" e o usuario tem qualquer role', async () => {
    setup('CAMAREIRA', ['all']);
    expect(protectedElement()).not.toBeNull();
  });

  // Teste 7b - Wildcard 'all' sem role (fail-closed)
  it('nao deve renderizar quando allowedRoles contem "all" mas o usuario nao tem role', () => {
    setup(null, ['all']);
    expect(protectedElement()).toBeNull();
  });

  // Compatibilidade: hasRole existe no servico
  it('AuthSignalService expoe hasRole para uso pela diretiva', () => {
    setup('DONO');
    expect(typeof authMock.hasRole).toBe('function');
  });
});
