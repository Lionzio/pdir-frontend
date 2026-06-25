import { Injectable, computed, signal } from '@angular/core';

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
  }

  clearSession(): void {
    this.state.set({
      accessToken: null,
      email: null,
      role: null,
      permissions: [],
    });
  }

  hasPermission(permissionCode: string): boolean {
    const userPerms = this.state().permissions;
    return userPerms.includes('all') || userPerms.includes(permissionCode);
  }
}
