import { Injectable, OnDestroy, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AuthState {
  accessToken: string | null;
  email: string | null;
  userId: number | null;
  role: string | null;
  permissions: string[];
}

export interface SessionClaims {
  sub: string;
  user_id: number;
  role: string;
  permissions: string[];
}

const EMPTY_STATE: AuthState = {
  accessToken: null,
  email: null,
  userId: null,
  role: null,
  permissions: [],
};

const REFRESH_URL = '/api/v1/auth/refresh';
const LOGOUT_CHANNEL = 'pdir-auth';

/**
 * Sessão do usuário **só em memória** (T-19).
 *
 * O access token não é mais gravado no localStorage, onde qualquer XSS o leria. Ao recarregar a
 * página, a sessão é restaurada pelo refresh token, que fica num cookie HttpOnly inacessível ao
 * JavaScript. O logout é propagado às outras abas por BroadcastChannel (sem gravar nada no storage).
 */
@Injectable({
  providedIn: 'root',
})
export class AuthSignalService implements OnDestroy {
  private platformId = inject(PLATFORM_ID);
  // Cliente sem interceptors: a restauração da sessão não pode disparar o refresh do interceptor
  private rawHttp = new HttpClient(inject(HttpBackend));
  private channel: BroadcastChannel | null = null;

  private state = signal<AuthState>(EMPTY_STATE);

  // Seletores públicos imutáveis
  readonly accessToken = computed(() => this.state().accessToken);
  readonly email = computed(() => this.state().email);
  readonly isAuthenticated = computed(() => !!this.state().accessToken);
  readonly userId = computed(() => this.state().userId);
  readonly role = computed(() => this.state().role);
  readonly permissions = computed(() => this.state().permissions);

  constructor() {
    if (isPlatformBrowser(this.platformId) && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(LOGOUT_CHANNEL);
      this.channel.onmessage = (event: MessageEvent) => {
        if (event.data === 'logout') this.state.set(EMPTY_STATE);
      };
    }
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }

  /** Restaura a sessão no boot pelo cookie HttpOnly do refresh; sem cookie válido, segue deslogado. */
  async initializeSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const res = await firstValueFrom(
        this.rawHttp.post<{ access_token: string }>(REFRESH_URL, {}, { withCredentials: true }),
      );
      if (!this.applyAccessToken(res.access_token)) this.state.set(EMPTY_STATE);
    } catch {
      this.state.set(EMPTY_STATE);
    }
  }

  /** Aplica um access token recebido do backend, se tiver os claims obrigatórios. */
  applyAccessToken(token: string): boolean {
    const decoded = this.decodeTokenPayload(token);
    if (!decoded || !decoded['sub'] || !decoded['user_id'] || !decoded['role']) return false;
    this.updateSession(token, {
      sub: decoded['sub'] as string,
      user_id: decoded['user_id'] as number,
      role: decoded['role'] as string,
      permissions: (decoded['permissions'] as string[]) || [],
    });
    return true;
  }

  updateSession(token: string, payload: SessionClaims): void {
    this.state.set({
      accessToken: token,
      email: payload.sub,
      userId: payload.user_id,
      role: payload.role,
      permissions: payload.permissions,
    });
  }

  clearSession(): void {
    this.state.set(EMPTY_STATE);
    this.channel?.postMessage('logout');
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
}
