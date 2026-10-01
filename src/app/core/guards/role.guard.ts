import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthSignalService } from '../services/auth-signal.service';

/**
 * Guard por papel (T-34): sem sessão → /login; papel fora da lista → mapa de quartos.
 * As listas espelham o RoleChecker do backend de cada tela.
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthSignalService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      return router.parseUrl('/login');
    }
    return authService.hasRole(allowedRoles) ? true : router.parseUrl('/admin/rooms');
  };
}
