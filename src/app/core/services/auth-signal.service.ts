import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthStorageService } from './auth-storage.service';

export interface AuthState {
  accessToken: string | null;
  email: string | null;
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
    role: null,
    permissions: [],
  });

  // Seletores públicos imutáveis
  readonly accessToken = computed(() => this.state().accessToken);
  readonly isAuthenticated = computed(() => !!this.state().accessToken);
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
    payload: { sub: string; role: string; permissions: string[] },
  ): void {
    this.state.set({
      accessToken: token,
      email: payload.sub,
      role: payload.role,
      permissions: payload.permissions,
    });

    this.authStorage.saveSession({ token, payload });
  }

  clearSession(): void {
    this.state.set({
      accessToken: null,
      email: null,
      role: null,
      permissions: [],
    });
    this.authStorage.clearSession();
  }

  hasPermission(permissionCode: string): boolean {
    const userPerms = this.state().permissions;
    return userPerms.includes('all') || userPerms.includes(permissionCode);
  }

  private isTokenValid(token: string): boolean {
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return false;

      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );

      const decoded = JSON.parse(jsonPayload);
      if (!decoded.exp) return true; // Se não houver data de expiração, considera válido

      const expirationDate = new Date(decoded.exp * 1000);
      return expirationDate > new Date();
    } catch {
      return false; // Se não conseguiu parsear o JWT, considera inválido
    }
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
