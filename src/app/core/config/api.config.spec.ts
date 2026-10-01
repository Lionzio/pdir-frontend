import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { RoomsService } from '../../features/rooms/services/rooms.service';
import { ReservationsService } from '../../features/reservations/services/reservations.service';
import { FinanceService } from '../../features/finance/services/finance.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthSignalService } from '../services/auth-signal.service';
import { IamService } from '../services/iam.service';
import { IntegrationsService } from '../services/integrations.service';
import { LogoutService } from '../services/logout.service';
import { API_BASE_URL } from './api.config';

const REMOTE = 'https://api.hotel.example/api/v1';

describe('API_BASE_URL (T-36)', () => {
  it('vem do environment do build, sem barra final', () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(API_BASE_URL)).toBe(environment.apiBaseUrl.replace(/\/+$/, ''));
  });

  describe('serviços montam as URLs a partir da base configurada', () => {
    let http: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([authInterceptor])),
          provideHttpClientTesting(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: API_BASE_URL, useValue: REMOTE },
        ],
      });
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('quartos, reservas, financeiro, IAM e integrações', () => {
      TestBed.inject(RoomsService).loadRooms();
      TestBed.inject(ReservationsService).listReservations().subscribe();
      TestBed.inject(FinanceService).getStatementByReservation(5).subscribe();
      TestBed.inject(IamService).listByStatus('PENDING_APPROVAL').subscribe();
      TestBed.inject(IntegrationsService).getSheetsStatus().subscribe();

      http.expectOne(`${REMOTE}/rooms`).flush([]);
      http.expectOne((r) => r.url === `${REMOTE}/reservations`).flush([]);
      http.expectOne(`${REMOTE}/finance/accounts/reservation/5`).flush({});
      http.expectOne((r) => r.url === `${REMOTE}/iam/users`).flush([]);
      http.expectOne(`${REMOTE}/integrations/sheets/status`).flush({});
    });

    it('refresh do interceptor e logout usam a mesma base', async () => {
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      TestBed.inject(AuthSignalService).updateSession('expirado', {
        sub: 'gerente@exemplo.test',
        user_id: 7,
        role: 'GERENTE',
        permissions: [],
      });

      TestBed.inject(HttpClient)
        .get(`${REMOTE}/rooms`)
        .subscribe({ error: () => undefined });
      http.expectOne(`${REMOTE}/rooms`).flush('x', { status: 401, statusText: 'Unauthorized' });
      const refresh = http.expectOne(`${REMOTE}/auth/refresh`);
      expect(refresh.request.withCredentials).toBeTrue();
      refresh.flush('x', { status: 401, statusText: 'Unauthorized' });

      const done = TestBed.inject(LogoutService).logout();
      http.expectOne(`${REMOTE}/auth/logout`).flush({});
      await done;
    });
  });
});
