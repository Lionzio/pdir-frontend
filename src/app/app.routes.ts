import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'admin/sync',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/sync-panel/sync-panel.component').then((m) => m.SyncPanelComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./app.component').then((m) => m.AppComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
