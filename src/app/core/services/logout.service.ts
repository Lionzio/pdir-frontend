import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthSignalService } from './auth-signal.service';

/**
 * Encerra a sessão (T-38): revoga o access token e o refresh token no backend (denylist, T-04),
 * limpa a sessão local e volta para o login. A sessão local é encerrada mesmo se a revogação falhar.
 */
@Injectable({ providedIn: 'root' })
export class LogoutService {
  private http = inject(HttpClient);
  private auth = inject(AuthSignalService);
  private router = inject(Router);

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/v1/auth/logout', {}, { withCredentials: true }));
    } catch {
      // Sem rede ou token já expirado: o importante é não manter a sessão neste navegador
    } finally {
      this.auth.clearSession();
      await this.router.navigateByUrl('/login');
    }
  }
}
