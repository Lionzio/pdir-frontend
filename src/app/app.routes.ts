import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

// Papéis por tela, como no backend (RoleChecker): gestão = DONO/GERENTE; operação inclui a recepção
const MANAGEMENT = ['DONO', 'GERENTE'];
const FRONT_DESK = ['DONO', 'GERENTE', 'RECEPCIONISTA'];

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
    canActivate: [authGuard, roleGuard(MANAGEMENT)],
    loadComponent: () =>
      import('./features/admin/sync-panel/sync-panel.component').then((m) => m.SyncPanelComponent),
  },
  {
    path: 'admin/reservations',
    canActivate: [authGuard, roleGuard(FRONT_DESK)],
    loadComponent: () =>
      import('./features/reservations/pages/reservations-page.component').then(
        (m) => m.ReservationsPageComponent,
      ),
  },
  {
    path: 'admin/reservations/new',
    canActivate: [authGuard, roleGuard(FRONT_DESK)],
    loadComponent: () =>
      import('./features/reservations/new-stepper/new-reservation-stepper.component').then(
        (m) => m.NewReservationStepperComponent,
      ),
  },
  {
    path: 'admin/finance',
    canActivate: [authGuard, roleGuard(MANAGEMENT)],
    loadComponent: () =>
      import('./features/finance/pages/finance-dashboard.component').then(
        (m) => m.FinanceDashboardComponent,
      ),
  },
  {
    path: 'admin/approvals',
    canActivate: [authGuard, roleGuard(MANAGEMENT)],
    loadComponent: () =>
      import('./features/admin/approvals/approvals-page.component').then(
        (m) => m.ApprovalsPageComponent,
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
