import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthSignalService } from '../services/auth-signal.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthSignalService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/login');
};
