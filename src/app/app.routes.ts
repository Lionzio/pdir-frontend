import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'admin/rooms',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/rooms/room-map/room-map.component').then((m) => m.RoomMapComponent),
  },
  {
    path: 'admin/sync',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/sync-panel/sync-panel.component').then((m) => m.SyncPanelComponent),
  },
  {
    path: 'admin/reservations',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reservations/pages/reservations-page.component').then(
        (m) => m.ReservationsPageComponent,
      ),
  },
  {
    path: 'admin/reservations/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reservations/new-stepper/new-reservation-stepper.component').then(
        (m) => m.NewReservationStepperComponent,
      ),
  },
  {
    path: 'admin/finance',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/finance/pages/finance-dashboard.component').then(
        (m) => m.FinanceDashboardComponent,
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'admin/rooms',
  },
  {
    path: '**',
    redirectTo: 'admin/rooms',
  },
];
