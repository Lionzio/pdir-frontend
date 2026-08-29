import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface TimelineRoom {
  id: number;
  number: string;
  categoryName: string;
}

export interface TimelineReservation {
  id: number;
  roomId: number;
  guestName: string;
  checkIn: string; // ISO string
  checkOut: string; // ISO string
  status: string;
}

@Component({
  selector: 'app-reservation-timeline',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timeline-container">
      <header class="timeline-header">
        <button mat-icon-button (click)="previousMonth()" aria-label="Mês anterior">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <h2>{{ currentMonthLabel() }}</h2>
        <button mat-icon-button (click)="nextMonth()" aria-label="Próximo mês">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </header>

      <div class="timeline-body">
        <!-- Coluna de Quartos -->
        <div class="rooms-column">
          <div class="cell header-cell">Quartos</div>
          @for (room of rooms(); track room.id) {
            <div class="cell room-cell">
              <strong>{{ room.number }}</strong>
              <small>{{ room.categoryName }}</small>
            </div>
          }
        </div>

        <!-- Grade de Dias com overflow-x -->
        <div class="days-grid-wrapper">
          <div class="days-grid">
            <!-- Cabeçalho de Dias -->
            <div class="days-row header-row">
              @for (day of daysInMonth(); track day) {
                <div class="cell day-header-cell">{{ day.getDate() }}</div>
              }
            </div>

            <!-- Linhas de Quartos com Reservas -->
            @for (room of rooms(); track room.id) {
              <div class="days-row">
                @for (day of daysInMonth(); track day) {
                  <div class="cell day-cell">
                    <!-- Renderiza a reserva se cair neste dia -->
                    @if (getReservationForRoomAndDay(room.id, day)) {
                      <div
                        class="reservation-pill"
                        tabindex="0"
                        [class.starts-today]="
                          isStartDay(getReservationForRoomAndDay(room.id, day)!, day)
                        "
                        [class.ends-today]="
                          isEndDay(getReservationForRoomAndDay(room.id, day)!, day)
                        "
                        [matTooltip]="getReservationForRoomAndDay(room.id, day)!.guestName"
                        (click)="reservationClick.emit(getReservationForRoomAndDay(room.id, day)!)"
                        (keyup.enter)="
                          reservationClick.emit(getReservationForRoomAndDay(room.id, day)!)
                        "
                      >
                        <!-- Mostra o nome apenas no primeiro dia da reserva neste mês -->
                        @if (
                          isStartDay(getReservationForRoomAndDay(room.id, day)!, day) ||
                          day.getDate() === 1
                        ) {
                          <span class="truncate">{{
                            getReservationForRoomAndDay(room.id, day)!.guestName
                          }}</span>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        background: var(--color-background, #fafafa);
      }
      .timeline-container {
        display: flex;
        flex-direction: column;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      }
      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background: #fff;
        border-bottom: 1px solid #e0e0e0;
      }
      .timeline-body {
        display: flex;
        background: #fff;
      }
      .rooms-column {
        flex: 0 0 200px;
        border-right: 2px solid #e0e0e0;
        background: #fafafa;
        z-index: 2;
      }
      .days-grid-wrapper {
        flex: 1 1 auto;
        overflow-x: auto; /* Rolagem horizontal */
      }
      .days-grid {
        display: flex;
        flex-direction: column;
        min-width: max-content;
      }
      .days-row {
        display: flex;
      }
      .cell {
        height: 60px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        border-bottom: 1px solid #f0f0f0;
        border-right: 1px solid #f0f0f0;
        box-sizing: border-box;
      }
      .room-cell {
        padding: 0 16px;
      }
      .room-cell small {
        color: #666;
      }
      .day-header-cell {
        width: 48px;
        align-items: center;
        font-weight: 500;
        color: #666;
        background: #fafafa;
      }
      .header-cell,
      .header-row .cell {
        height: 48px;
        border-bottom: 2px solid #e0e0e0;
      }
      .header-cell {
        align-items: center;
        font-weight: 500;
      }
      .day-cell {
        width: 48px;
        position: relative;
      }
      .reservation-pill {
        position: absolute;
        top: 10%;
        height: 80%;
        left: 0;
        right: 0;
        background-color: var(--color-primary, #e65100);
        color: white;
        display: flex;
        align-items: center;
        padding: 0 4px;
        font-size: 11px;
        cursor: pointer;
        z-index: 1;
      }
      .reservation-pill.starts-today {
        left: 4px;
        border-top-left-radius: 4px;
        border-bottom-left-radius: 4px;
      }
      .reservation-pill.ends-today {
        right: 4px;
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
      }
      .truncate {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class ReservationTimelineComponent {
  // Inputs
  rooms = input<TimelineRoom[]>([]);
  reservations = input<TimelineReservation[]>([]);

  // Outputs
  reservationClick = output<TimelineReservation>();
  dateRangeChange = output<{ start: Date; end: Date }>();

  // Internal State (Signals)
  currentDate = signal<Date>(new Date());

  // Computed
  currentMonthLabel = computed(() => {
    const d = this.currentDate();
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  });

  daysInMonth = computed(() => {
    const date = this.currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  });

  // Actions
  previousMonth() {
    this.currentDate.update((d) => {
      const newD = new Date(d);
      newD.setMonth(d.getMonth() - 1);
      return newD;
    });
    this.emitRange();
  }

  nextMonth() {
    this.currentDate.update((d) => {
      const newD = new Date(d);
      newD.setMonth(d.getMonth() + 1);
      return newD;
    });
    this.emitRange();
  }

  private emitRange() {
    const days = this.daysInMonth();
    if (days.length > 0) {
      this.dateRangeChange.emit({
        start: days[0],
        end: days[days.length - 1],
      });
    }
  }

  // Helpers
  // Nota: Uma abordagem baseada em dicionários O(1) seria melhor para produção,
  // mas como o escopo é o design base da US-06.2, O(N) atende por agora.
  getReservationForRoomAndDay(roomId: number, date: Date): TimelineReservation | undefined {
    const time = date.getTime();
    return this.reservations().find((r) => {
      if (r.roomId !== roomId) return false;

      const start = new Date(r.checkIn).getTime();
      const end = new Date(r.checkOut).getTime();

      // Considera a reserva ativa no dia se (start <= date) e (date < end)
      // pois checkOut é não incluso na pernoite (diária)
      return time >= start && time < end;
    });
  }

  isStartDay(res: TimelineReservation, date: Date): boolean {
    return new Date(res.checkIn).getTime() === date.getTime();
  }

  isEndDay(res: TimelineReservation, date: Date): boolean {
    // Para renderizar o pílula, o "último dia visível" é o dia anterior ao checkOut
    const checkOut = new Date(res.checkOut);
    const lastNight = new Date(checkOut.getTime() - 24 * 60 * 60 * 1000);
    return lastNight.getTime() === date.getTime();
  }
}
