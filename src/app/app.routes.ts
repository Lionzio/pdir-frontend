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
    pathMatch: 'full',
    redirectTo: 'admin/sync',
  },
  {
    path: '**',
    redirectTo: 'admin/sync',
  },
];
