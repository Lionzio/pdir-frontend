import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  ReservationTimelineComponent,
  TimelineRoom,
  TimelineReservation,
} from '../timeline/reservation-timeline.component';
import { ReservationsService, Reservation } from '../services/reservations.service';
import {
  ReservationDetailData,
  ReservationDetailDialogComponent,
  ReservationDetailResult,
} from '../detail/reservation-detail-dialog.component';
import { RoomsService } from '../../rooms/services/rooms.service';

import { RouterModule } from '@angular/router';
import { RbacAllowDirective } from '../../../core/directives/rbac-allow.directive';

@Component({
  selector: 'app-reservations-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReservationTimelineComponent,
    RouterModule,
    RbacAllowDirective,
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div class="title-area">
          <h1>Reservas</h1>
        </div>
        <div class="header-actions" style="display: flex; gap: 16px; align-items: center;">
          <button mat-stroked-button routerLink="/admin/rooms">
            <mat-icon>dashboard</mat-icon> Matriz de Quartos
          </button>

          <ng-container *appRbacAllow="['DONO', 'GERENTE', 'RECEPCIONISTA']">
            <button mat-flat-button color="primary" routerLink="/admin/reservations/new">
              <mat-icon>add</mat-icon>
              Nova Reserva
            </button>
          </ng-container>
        </div>
      </header>

      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Carregando dados...</p>
        </div>
      } @else {
        <app-reservation-timeline
          [rooms]="timelineRooms()"
          [reservations]="timelineReservations()"
          (reservationClick)="onReservationClick($event)"
          (dateRangeChange)="onDateRangeChange($event)"
        ></app-reservation-timeline>
      }
    </div>
  `,
  styles: [
    `
      .page-container {
        padding: 24px;
        height: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .page-header h1 {
        margin: 0;
        color: #333;
      }
      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 300px;
        color: #666;
        gap: 16px;
      }
    `,
  ],
})
export class ReservationsPageComponent implements OnInit {
  private router = inject(Router);
  private reservationsService = inject(ReservationsService);
  private roomsService = inject(RoomsService);

  loading = signal(true);
  private dialog = inject(MatDialog);
  private lastRange: { start: Date; end: Date } | null = null;

  private _reservations = signal<Reservation[]>([]);

  // Convert Rooms to TimelineRoom
  timelineRooms = computed<TimelineRoom[]>(() => {
    return this.roomsService.rooms().map((r) => ({
      id: r.id,
      number: r.number ?? String(r.id),
      categoryName: r.category?.name || 'Padrão',
    }));
  });

  // Convert Reservation to TimelineReservation
  timelineReservations = computed<TimelineReservation[]>(() => {
    return this._reservations().map((r) => ({
      id: r.id,
      roomId: r.room_id,
      guestName: r.guest_name?.trim() || 'Hóspede', // nome real vindo da API (T-33)
      checkIn: r.check_in,
      checkOut: r.check_out,
      status: r.status,
    }));
  });

  ngOnInit() {
    this.roomsService.loadRooms();
    this.loadReservations();
  }

  loadReservations(startDate?: Date, endDate?: Date) {
    this.loading.set(true);
    this.reservationsService.listReservations(startDate, endDate).subscribe({
      next: (res) => {
        this._reservations.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  goToNewReservation() {
    this.router.navigate(['/admin/reservations/new']);
  }

  /** Abre o detalhe da reserva com check-in, check-out e conta (T-40). */
  onReservationClick(res: TimelineReservation) {
    const room = this.timelineRooms().find((r) => r.id === res.roomId);
    const data: ReservationDetailData = {
      id: res.id,
      guestName: res.guestName,
      roomNumber: room?.number ?? String(res.roomId),
      checkIn: res.checkIn,
      checkOut: res.checkOut,
      status: res.status,
    };
    this.dialog
      .open<ReservationDetailDialogComponent, ReservationDetailData, ReservationDetailResult>(
        ReservationDetailDialogComponent,
        { data, width: '560px' },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result?.changed) this.loadReservations(this.lastRange?.start, this.lastRange?.end);
      });
  }

  onDateRangeChange(range: { start: Date; end: Date }) {
    this.lastRange = range;
    this.loadReservations(range.start, range.end);
  }
}
