import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthSignalService } from './auth-signal.service';
import { API_BASE_URL } from '../../core/config/api.config';

/**
 * Encerra a sessão (T-38): revoga o access token e o refresh token no backend (denylist, T-04),
 * limpa a sessão local e volta para o login. A sessão local é encerrada mesmo se a revogação falhar.
 */
@Injectable({ providedIn: 'root' })
export class LogoutService {
  private http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private auth = inject(AuthSignalService);
  private router = inject(Router);

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.api}/auth/logout`, {}, { withCredentials: true }),
      );
    } catch {
      // Sem rede ou token já expirado: o importante é não manter a sessão neste navegador
    } finally {
      this.auth.clearSession();
      await this.router.navigateByUrl('/login');
    }
  }
}
