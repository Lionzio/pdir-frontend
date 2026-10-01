import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { RoomStatus } from '../models/room.model';
import { RoomsService } from '../services/rooms.service';
import { RbacAllowDirective } from '../../../core/directives/rbac-allow.directive';

import { AuthSignalService } from '../../../core/services/auth-signal.service';

export interface RoomActionDialogData {
  roomId: number;
}

@Component({
  selector: 'app-room-action-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RbacAllowDirective,
  ],
  template: `
    @if (room()) {
      <h2 mat-dialog-title>Quarto {{ room()!.number }}</h2>
      <mat-dialog-content>
        <div class="room-details">
          <p><strong>Andar:</strong> {{ room()!.floor }}</p>
          <p><strong>Categoria:</strong> {{ room()!.category?.name || 'Não informada' }}</p>
          <p>
            <strong>Status Atual:</strong>
            <span class="current-status" [ngClass]="getRoomStatusClass(room()!.status)">{{
              getStatusLabel(room()!.status)
            }}</span>
          </p>
        </div>

        <div class="actions-section">
          <h3>Ações Disponíveis</h3>

          <div class="action-buttons">
            <ng-container *appRbacAllow="['DONO', 'GERENTE', 'RECEPCIONISTA', 'CAMAREIRA']">
              @if (room()!.status !== 'AVAILABLE' && canCamareiraMakeAvailable()) {
                <button
                  mat-stroked-button
                  class="btn-available"
                  (click)="updateStatus('AVAILABLE')"
                  [disabled]="isUpdating()"
                >
                  <mat-icon>check_circle</mat-icon> Disponibilizar (Check-out/Limpo)
                </button>
              }
              <ng-container *appRbacAllow="['DONO', 'GERENTE', 'RECEPCIONISTA']">
                @if (room()!.status !== 'OCCUPIED') {
                  <button
                    mat-stroked-button
                    class="btn-occupied"
                    (click)="updateStatus('OCCUPIED')"
                    [disabled]="isUpdating()"
                  >
                    <mat-icon>hotel</mat-icon> Ocupar (Check-in)
                  </button>
                }
              </ng-container>
            </ng-container>

            <ng-container *appRbacAllow="['DONO', 'GERENTE']">
              @if (room()!.status !== 'CLEANING') {
                <button
                  mat-stroked-button
                  class="btn-cleaning"
                  (click)="updateStatus('CLEANING')"
                  [disabled]="isUpdating()"
                >
                  <mat-icon>cleaning_services</mat-icon> Enviar p/ Limpeza
                </button>
              }
              @if (room()!.status !== 'MAINTENANCE') {
                <button
                  mat-stroked-button
                  class="btn-maintenance"
                  (click)="updateStatus('MAINTENANCE')"
                  [disabled]="isUpdating()"
                >
                  <mat-icon>build</mat-icon> Manutenção
                </button>
              }
              @if (room()!.status !== 'OUT_OF_SERVICE') {
                <button
                  mat-stroked-button
                  class="btn-out-of-service"
                  (click)="updateStatus('OUT_OF_SERVICE')"
                  [disabled]="isUpdating()"
                >
                  <mat-icon>block</mat-icon> Interditar
                </button>
              }
            </ng-container>
          </div>

          @if (isUpdating()) {
            <div class="updating-indicator">
              <mat-spinner diameter="20"></mat-spinner>
              <span>Processando...</span>
            </div>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Fechar</button>
      </mat-dialog-actions>
    } @else {
      <div class="not-found">
        <p>Quarto não encontrado ou removido.</p>
        <button mat-button mat-dialog-close>Fechar</button>
      </div>
    }
  `,
  styles: [
    `
      .room-details {
        margin-bottom: 1.5rem;
        padding: 1rem;
        background-color: #f8fafc;
        border-radius: 8px;
      }

      .room-details p {
        margin: 4px 0;
      }

      .current-status {
        font-weight: bold;
      }

      .actions-section h3 {
        font-size: 1rem;
        margin-bottom: 1rem;
        color: #475569;
      }

      .action-buttons {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .action-buttons button {
        width: 100%;
        justify-content: flex-start;
      }

      .updating-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 1rem;
        color: var(--color-occupied);
      }

      .btn-available {
        color: var(--color-available);
      }
      .btn-occupied {
        color: var(--color-occupied);
      }
      .btn-cleaning {
        color: var(--color-cleaning);
      }
      .btn-maintenance {
        color: var(--color-maintenance);
      }
      .btn-out-of-service {
        color: var(--color-out-of-service);
      }

      .status-available {
        color: var(--color-available);
      }
      .status-occupied {
        color: var(--color-occupied);
      }
      .status-cleaning {
        color: var(--color-cleaning);
      }
      .status-maintenance {
        color: var(--color-maintenance);
      }
      .status-out-of-service {
        color: var(--color-out-of-service);
      }

      .not-found {
        padding: 2rem;
        text-align: center;
      }
    `,
  ],
})
export class RoomActionDialogComponent {
  private data = inject<RoomActionDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<RoomActionDialogComponent>);
  private roomsService = inject(RoomsService);
  private snackBar = inject(MatSnackBar);
  private authService = inject(AuthSignalService);

  isUpdating = signal(false);

  // Computed signal to react to changes in the rooms service
  room = computed(() => {
    return this.roomsService.rooms().find((r) => r.id === this.data.roomId);
  });

  constructor() {
    // Detect status changes while dialog is open
    let initialStatus: string | null = null;

    effect(() => {
      const currentRoom = this.room();
      if (currentRoom) {
        if (initialStatus === null) {
          initialStatus = currentRoom.status;
        } else if (initialStatus !== currentRoom.status && !this.isUpdating()) {
          // Status changed via SSE while we were looking at it!
          this.snackBar.open(
            `Atenção: O status deste quarto foi alterado para ${this.getStatusLabel(currentRoom.status)} externamente.`,
            'Ciente',
            {
              duration: 6000,
              panelClass: ['warning-snackbar'],
            },
          );
          initialStatus = currentRoom.status; // update baseline
        }
      }
    });
  }

  canCamareiraMakeAvailable(): boolean {
    // Espelha o backend (RoomService.update_room_status): gestores e recepção sempre podem liberar.
    // Antes dependia de hasPermission('all'), claim que o backend não emite (T-34).
    const role = this.authService.role();
    if (role === 'DONO' || role === 'GERENTE' || role === 'RECEPCIONISTA') {
      return true;
    }
    // Se for camareira, apenas se o status for CLEANING ou OCCUPIED.
    if (this.authService.role() === 'CAMAREIRA') {
      const status = this.room()?.status;
      return status === 'CLEANING' || status === 'OCCUPIED';
    }
    return false;
  }

  updateStatus(newStatus: RoomStatus): void {
    const currentRoom = this.room();
    if (!currentRoom) return;

    this.isUpdating.set(true);
    this.roomsService.updateRoomStatus(currentRoom.id, newStatus).subscribe({
      next: () => {
        this.isUpdating.set(false);
        this.snackBar.open('Status do quarto atualizado com sucesso!', 'Fechar', {
          duration: 3000,
          panelClass: ['success-snackbar'],
        });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.isUpdating.set(false);
        const msg =
          err.status === 403
            ? 'Sem permissão para esta ação.'
            : 'Falha ao atualizar o status do quarto.';

        this.snackBar.open(msg, 'Fechar', {
          duration: 5000,
          panelClass: ['feedback-error'],
        });
      },
    });
  }

  getRoomStatusClass(status: string): string {
    switch (status) {
      case 'AVAILABLE':
        return 'status-available';
      case 'OCCUPIED':
        return 'status-occupied';
      case 'CLEANING':
        return 'status-cleaning';
      case 'MAINTENANCE':
        return 'status-maintenance';
      case 'OUT_OF_SERVICE':
        return 'status-out-of-service';
      default:
        return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'AVAILABLE':
        return 'Disponível';
      case 'OCCUPIED':
        return 'Ocupado';
      case 'CLEANING':
        return 'Limpeza';
      case 'MAINTENANCE':
        return 'Manutenção';
      case 'OUT_OF_SERVICE':
        return 'Interditado';
      default:
        return status;
    }
  }
}
