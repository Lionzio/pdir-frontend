import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  OnDestroy,
  computed,
  signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CommonModule } from '@angular/common';
import { RoomsService } from '../services/rooms.service';
import { Room } from '../models/room.model';
import { RoomActionDialogComponent, RoomActionDialogData } from './room-action-dialog.component';
import { RoomEditDialogComponent, RoomEditDialogData } from './room-edit-dialog.component';
import { RbacAllowDirective } from '../../../core/directives/rbac-allow.directive';

@Component({
  selector: 'app-room-map',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatDialogModule,
    MatButtonToggleModule,
    RbacAllowDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="room-map-container">
      <header class="room-map-header">
        <div class="title-area">
          <h1>Matriz de Quartos</h1>
          <p>Visão em tempo real da situação dos quartos do hotel</p>
        </div>
        <div class="header-actions">
          <div
            class="status-badge"
            [class.connected]="connected()"
            [class.disconnected]="!connected()"
          >
            <mat-icon>{{ connected() ? 'wifi_tethering' : 'wifi_off' }}</mat-icon>
            <span>{{ connected() ? 'Ao Vivo (SSE)' : 'Desconectado' }}</span>
          </div>
          <ng-container *appRbacAllow="['DONO', 'GERENTE']">
            <button mat-flat-button color="primary" (click)="openEditMetadataDialog()">
              <mat-icon>add</mat-icon> Novo Quarto
            </button>
          </ng-container>
        </div>
      </header>

      <div class="filters-container">
        <mat-button-toggle-group
          [value]="statusFilter()"
          (change)="statusFilter.set($event.value)"
          aria-label="Filtro de Status"
        >
          <mat-button-toggle value="ALL">Todos</mat-button-toggle>
          <mat-button-toggle value="AVAILABLE">Disponíveis</mat-button-toggle>
          <mat-button-toggle value="OCCUPIED">Ocupados</mat-button-toggle>
          <mat-button-toggle value="CLEANING">Limpeza</mat-button-toggle>
          <mat-button-toggle value="MAINTENANCE">Manutenção</mat-button-toggle>
          <mat-button-toggle value="OUT_OF_SERVICE">Interditados</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Carregando matriz de quartos...</p>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <mat-icon color="warn">error_outline</mat-icon>
          <p>{{ error() }}</p>
          <button mat-flat-button color="primary" (click)="retry()">Tentar Novamente</button>
        </div>
      } @else if (rooms().length === 0) {
        <div class="empty-state">
          <mat-icon>hotel</mat-icon>
          <p>Nenhum quarto encontrado no sistema.</p>
        </div>
      } @else {
        <div class="floors-container">
          <!-- Térreo -->
          @if (terreo().length > 0) {
            <div class="floor-section">
              <h2 class="floor-title">Térreo</h2>
              <div class="rooms-grid">
                @for (room of terreo(); track room.id) {
                  <ng-container
                    *ngTemplateOutlet="roomCardTemplate; context: { $implicit: room }"
                  ></ng-container>
                }
              </div>
            </div>
          }

          <!-- Primeiro Andar -->
          @if (primeiroAndar().length > 0) {
            <div class="floor-section">
              <h2 class="floor-title">Primeiro Andar</h2>
              <div class="rooms-grid">
                @for (room of primeiroAndar(); track room.id) {
                  <ng-container
                    *ngTemplateOutlet="roomCardTemplate; context: { $implicit: room }"
                  ></ng-container>
                }
              </div>
            </div>
          }

          <!-- Anexos -->
          @if (anexos().length > 0) {
            <div class="floor-section">
              <h2 class="floor-title">Anexos</h2>
              <div class="rooms-grid">
                @for (room of anexos(); track room.id) {
                  <ng-container
                    *ngTemplateOutlet="roomCardTemplate; context: { $implicit: room }"
                  ></ng-container>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Template do Card de Quarto -->
    <ng-template #roomCardTemplate let-room>
      <mat-card class="room-card" [ngClass]="getRoomStatusClass(room.status)">
        <mat-card-header>
          <div mat-card-avatar class="status-avatar">
            <mat-icon>{{ getStatusIcon(room.status) }}</mat-icon>
          </div>
          <mat-card-title>Quarto {{ room.number }}</mat-card-title>
          <mat-card-subtitle class="status-text">{{
            getStatusLabel(room.status)
          }}</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="room-details">
            <p><mat-icon>layers</mat-icon> Andar: {{ room.floor }}</p>
            <p><mat-icon>category</mat-icon> {{ room.category?.name || 'Desconhecida' }}</p>
            <p><mat-icon>group</mat-icon> Capacidade: {{ room.capacity || 1 }}</p>
          </div>
        </mat-card-content>

        <mat-card-actions align="end" class="card-actions">
          <button mat-button color="primary" (click)="openStatusActionDialog(room)">
            <mat-icon>swap_horiz</mat-icon> Status
          </button>

          <ng-container *appRbacAllow="['DONO', 'GERENTE']">
            <button
              mat-button
              class="edit-btn"
              (click)="$event.stopPropagation(); openEditMetadataDialog(room)"
            >
              <mat-icon>edit</mat-icon> Editar
            </button>
          </ng-container>
        </mat-card-actions>
      </mat-card>
    </ng-template>
  `,
  styles: [
    `
      .room-map-container {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
      }

      .room-map-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .filters-container {
        margin-bottom: 2rem;
        overflow-x: auto;
        padding-bottom: 0.5rem;
      }

      .title-area h1 {
        margin: 0;
        color: #2c3e50;
        font-size: 28px;
      }

      .title-area p {
        color: #7f8c8d;
        margin-top: 8px;
        font-size: 16px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .status-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 500;
        font-size: 14px;
      }

      .status-badge.connected {
        background-color: var(--color-available-bg);
        color: var(--color-available);
        border: 1px solid var(--color-available);
      }

      .status-badge.disconnected {
        background-color: var(--color-out-of-service-bg);
        color: var(--color-out-of-service);
        border: 1px solid var(--color-out-of-service);
      }

      .loading-state,
      .error-state,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 0;
        text-align: center;
      }

      .error-state mat-icon,
      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 1rem;
        color: #64748b;
      }

      .floors-container {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }

      .floor-title {
        font-size: 20px;
        color: #1e3a8a;
        margin-bottom: 1rem;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 0.5rem;
      }

      .rooms-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1.5rem;
      }

      .room-card {
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
        border-left: 6px solid transparent;
        padding: 0;
        overflow: hidden;
      }

      .room-details {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .room-details p {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        color: #475569;
        font-size: 0.9rem;
      }

      .room-details mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #64748b;
      }

      .room-card:hover {
        transform: translateY(-4px);
        box-shadow:
          0 10px 15px -3px rgba(0, 0, 0, 0.1),
          0 4px 6px -2px rgba(0, 0, 0, 0.05);
      }

      mat-card-header {
        padding: 16px 16px 0;
        margin-bottom: 8px;
      }

      .status-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: #f1f5f9;
      }

      .status-text {
        font-weight: 500;
      }

      mat-card-content {
        padding: 0 16px;
      }

      .card-actions {
        padding: 8px 16px;
        border-top: 1px solid #e2e8f0;
        margin-top: 16px;
      }

      .edit-btn {
        color: #64748b;
      }

      .status-available {
        border-left-color: var(--color-available);
      }
      .status-available .status-avatar {
        color: var(--color-available);
        background-color: var(--color-available-bg);
      }
      .status-available .status-text {
        color: var(--color-available);
      }

      .status-occupied {
        border-left-color: var(--color-occupied);
      }
      .status-occupied .status-avatar {
        color: var(--color-occupied);
        background-color: var(--color-occupied-bg);
      }
      .status-occupied .status-text {
        color: var(--color-occupied);
      }

      .status-cleaning {
        border-left-color: var(--color-cleaning);
      }
      .status-cleaning .status-avatar {
        color: var(--color-cleaning);
        background-color: var(--color-cleaning-bg);
      }
      .status-cleaning .status-text {
        color: var(--color-cleaning);
      }

      .status-maintenance {
        border-left-color: var(--color-maintenance);
      }
      .status-maintenance .status-avatar {
        color: var(--color-maintenance);
        background-color: var(--color-maintenance-bg);
      }
      .status-maintenance .status-text {
        color: var(--color-maintenance);
      }

      .status-out-of-service {
        border-left-color: var(--color-out-of-service);
      }
      .status-out-of-service .status-avatar {
        color: var(--color-out-of-service);
        background-color: var(--color-out-of-service-bg);
      }
      .status-out-of-service .status-text {
        color: var(--color-out-of-service);
      }
    `,
  ],
})
export class RoomMapComponent implements OnInit, OnDestroy {
  private roomsService = inject(RoomsService);
  private dialog = inject(MatDialog);

  statusFilter = signal<string>('ALL');

  rooms = this.roomsService.rooms;
  loading = this.roomsService.loading;
  connected = this.roomsService.connected;
  error = this.roomsService.error;

  private filteredRooms = computed(() => {
    const filter = this.statusFilter();
    return filter === 'ALL' ? this.rooms() : this.rooms().filter((r) => r.status === filter);
  });

  private getRoomsForFloor(floorNumber: number): Room[] {
    return this.filteredRooms()
      .filter((r) => r.floor === floorNumber)
      .sort((a, b) => a.number.localeCompare(b.number));
  }

  terreo = computed(() => this.getRoomsForFloor(1));
  primeiroAndar = computed(() => this.getRoomsForFloor(2));
  anexos = computed(() => {
    return this.filteredRooms()
      .filter((r) => r.floor > 2)
      .sort((a, b) => a.number.localeCompare(b.number));
  });

  ngOnInit(): void {
    this.roomsService.loadRooms();
    this.roomsService.connectToStream();
  }

  ngOnDestroy(): void {
    this.roomsService.disconnect();
  }

  retry(): void {
    this.roomsService.loadRooms();
    this.roomsService.connectToStream();
  }

  openStatusActionDialog(room: Room): void {
    this.dialog.open(RoomActionDialogComponent, {
      width: '400px',
      data: { roomId: room.id } as RoomActionDialogData,
      autoFocus: false,
    });
  }

  openEditMetadataDialog(room?: Room): void {
    this.dialog.open(RoomEditDialogComponent, {
      width: '500px',
      data: { room } as RoomEditDialogData,
      autoFocus: false,
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

  getStatusIcon(status: string): string {
    switch (status) {
      case 'AVAILABLE':
        return 'check_circle';
      case 'OCCUPIED':
        return 'hotel';
      case 'CLEANING':
        return 'cleaning_services';
      case 'MAINTENANCE':
        return 'build';
      case 'OUT_OF_SERVICE':
        return 'block';
      default:
        return 'help_outline';
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
