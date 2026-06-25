import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    // Componente placeholder provisório protegido
    loadComponent: () => import('./app.component').then((m) => m.AppComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
