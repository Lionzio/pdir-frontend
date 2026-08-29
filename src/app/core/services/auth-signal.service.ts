import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthStorageService } from './auth-storage.service';

export interface AuthState {
  accessToken: string | null;
  email: string | null;
  userId: number | null;
  role: string | null;
  permissions: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthSignalService {
  private authStorage = inject(AuthStorageService);
  private platformId = inject(PLATFORM_ID);

  // Estado privado reativo
  private state = signal<AuthState>({
    accessToken: null,
    email: null,
    userId: null,
    role: null,
    permissions: [],
  });

  // Seletores públicos imutáveis
  readonly accessToken = computed(() => this.state().accessToken);
  readonly email = computed(() => this.state().email);
  readonly isAuthenticated = computed(() => !!this.state().accessToken);
  readonly userId = computed(() => this.state().userId);
  readonly role = computed(() => this.state().role);
  readonly permissions = computed(() => this.state().permissions);

  constructor() {
    this.setupStorageListener();
  }

  initializeSession(): Promise<void> {
    return new Promise((resolve) => {
      const session = this.authStorage.getSession();

      if (session && this.isTokenValid(session.token)) {
        this.state.set({
          accessToken: session.token,
          email: session.payload.sub,
          userId: session.payload.user_id,
          role: session.payload.role,
          permissions: session.payload.permissions,
        });
      } else {
        this.clearSession(); // Garante a limpeza se expirado/inválido
      }

      resolve();
    });
  }

  updateSession(
    token: string,
    payload: { sub: string; user_id: number; role: string; permissions: string[] },
  ): void {
    this.state.set({
      accessToken: token,
      email: payload.sub,
      userId: payload.user_id,
      role: payload.role,
      permissions: payload.permissions,
    });

    this.authStorage.saveSession({ token, payload });
  }

  clearSession(): void {
    this.state.set({
      accessToken: null,
      email: null,
      userId: null,
      role: null,
      permissions: [],
    });
    this.authStorage.clearSession();
  }

  hasPermission(permissionCode: string): boolean {
    const userPerms = this.state().permissions;
    return userPerms.includes('all') || userPerms.includes(permissionCode);
  }

  /**
   * Verifica se o role atual do usuário está na lista de roles permitidos.
   *
   * Convenção especial: se `allowedRoles` contiver `'all'`, qualquer usuário
   * autenticado com um role definido é considerado autorizado.
   *
   * Retorna `false` se o usuário não estiver autenticado ou não possuir role.
   */
  hasRole(allowedRoles: string[]): boolean {
    const currentRole = this.state().role;
    if (!currentRole) return false;
    if (allowedRoles.includes('all')) return true;
    return allowedRoles.includes(currentRole);
  }

  /**
   * Decodifica o payload do JWT retornado pelo backend.
   * Utilizado para reconstrução segura do estado baseada nos claims do token.
   * IMPORTANTE: Não substitui a validação de assinatura que ocorre no backend.
   */
  decodeTokenPayload(token: string): Record<string, unknown> | null {
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return null;

      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );

      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  private isTokenValid(token: string): boolean {
    const decoded = this.decodeTokenPayload(token);
    if (!decoded) return false;

    if (!decoded['exp']) return true; // Se não houver data de expiração, considera válido

    const expirationDate = new Date((decoded['exp'] as number) * 1000);
    return expirationDate > new Date();
  }

  private setupStorageListener(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === this.authStorage.getStorageKey()) {
          // Se os dados mudaram em outra aba, inicializa a sessão novamente (ou desloga se tiverem limpado)
          this.initializeSession();
        }
      });
    }
  }
}
