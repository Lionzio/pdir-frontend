import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { interval } from 'rxjs';

import { IntegrationsService, SheetsSyncStatus } from '../../../core/services/integrations.service';

/** Sem sucesso há mais que isso, o painel alerta (T-37). */
export const STALE_AFTER_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = 30 * 1000;

@Component({
  selector: 'app-sync-panel',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="panel-container">
      <header class="panel-header">
        <h1>Integrações de Sistema</h1>
        <p>Gerenciamento de paridade com sistemas legados e planilhas</p>
      </header>

      <div class="cards-grid">
        <!-- Card: Google Sheets -->
        <mat-card class="integration-card" appearance="outlined">
          <mat-card-header>
            <mat-icon mat-card-avatar class="sheets-icon">table_chart</mat-icon>
            <mat-card-title>Google Sheets (SSOT Secundário)</mat-card-title>
            <mat-card-subtitle>Sincronização Bidirecional Ativa</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            @if (status(); as current) {
              @if (isStale()) {
                <div class="stale-alert" role="alert">
                  <mat-icon>warning</mat-icon>
                  <span>Sem sincronização bem-sucedida há mais de 15 minutos.</span>
                </div>
              }
              <div class="status-indicator">
                <mat-icon class="status-icon" [class.success]="!isStale()">schedule</mat-icon>
                <span class="last-sync">
                  Última sincronização:
                  {{
                    current.last_sync
                      ? (current.last_sync.finished_at | date: 'dd/MM HH:mm')
                      : 'nunca'
                  }}
                </span>
              </div>
              <p class="queue">Operações na fila de retentativa: {{ current.retry_queue_size }}</p>
              @if (current.recent_failures.length > 0) {
                <h4>Falhas recentes</h4>
                <ul class="failures">
                  @for (failure of current.recent_failures; track $index) {
                    <li>
                      {{ failure.timestamp | date: 'dd/MM HH:mm' }} · {{ failure.direction }} ·
                      {{ failure.description }}
                    </li>
                  }
                </ul>
              }
            } @else if (statusError()) {
              <p class="status-error" role="alert">{{ statusError() }}</p>
            }

            @if (isSyncing()) {
              <div class="loading-area">
                <p>Sincronizando dados em background...</p>
                <mat-progress-bar mode="indeterminate"></mat-progress-bar>
              </div>
            }
          </mat-card-content>

          <mat-card-actions align="end">
            <button
              mat-flat-button
              color="warn"
              (click)="triggerEmergencySync()"
              [disabled]="isSyncing()"
            >
              <mat-icon>sync_problem</mat-icon>
              Forçar Sincronização de Emergência
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- Placeholder para ERP Financeiro -->
        <mat-card class="integration-card disabled-card" appearance="outlined">
          <mat-card-header>
            <mat-icon mat-card-avatar>account_balance</mat-icon>
            <mat-card-title>ERP Financeiro</mat-card-title>
            <mat-card-subtitle>Módulo em Desenvolvimento</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="placeholder-text">Aguardando mapeamento de contas contábeis.</p>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .panel-container {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
      }
      .panel-header {
        margin-bottom: 2rem;
      }
      .panel-header h1 {
        margin: 0;
        color: #2c3e50;
        font-size: 28px;
      }
      .panel-header p {
        color: #7f8c8d;
        margin-top: 8px;
        font-size: 16px;
      }
      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
        gap: 1.5rem;
      }
      .integration-card {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .sheets-icon {
        color: #0f9d58;
        transform: scale(1.2);
      }
      .status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 1.5rem 0;
        font-weight: 500;
        color: #333;
      }
      .stale-alert {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 4px;
        background: #fef3c7;
        color: #92400e;
        margin-top: 1rem;
      }
      .failures {
        padding-left: 1.2rem;
        font-size: 13px;
        color: #b91c1c;
      }
      .status-error {
        color: #b91c1c;
      }
      .status-icon.success {
        color: #27ae60;
      }
      .loading-area {
        margin-top: 1rem;
      }
      .loading-area p {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: #555;
        font-weight: 500;
      }
      mat-card-content {
        flex-grow: 1;
      }
      .disabled-card {
        opacity: 0.6;
        pointer-events: none;
        background-color: #f9f9f9;
      }
      .placeholder-text {
        color: #95a5a6;
        font-style: italic;
        margin-top: 1rem;
      }
    `,
  ],
})
export class SyncPanelComponent implements OnInit {
  private integrationsService = inject(IntegrationsService);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  isSyncing = signal(false);
  status = signal<SheetsSyncStatus | null>(null);
  statusError = signal<string | null>(null);
  private now = signal(Date.now());

  // Alerta quando nunca sincronizou ou quando o último sucesso passou de 15 minutos
  isStale = computed(() => {
    const finishedAt = this.status()?.last_sync?.finished_at;
    if (!finishedAt) return true;
    return this.now() - new Date(finishedAt).getTime() > STALE_AFTER_MS;
  });

  ngOnInit(): void {
    this.loadStatus();
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadStatus());
  }

  loadStatus(): void {
    this.integrationsService.getSheetsStatus().subscribe({
      next: (status) => {
        this.now.set(Date.now());
        this.status.set(status);
        this.statusError.set(null);
      },
      error: () => this.statusError.set('Não foi possível consultar o status da sincronização.'),
    });
  }

  triggerEmergencySync(): void {
    this.isSyncing.set(true);

    this.integrationsService.forceSheetsSync().subscribe({
      next: (response) => {
        this.isSyncing.set(false);
        this.snackBar.open(response.message, 'OK', {
          duration: 5000,
          panelClass: ['success-snackbar'],
        });
        // A sincronização roda em background no backend; o status real vem da API (sem spinner simulado)
        this.loadStatus();
      },
      error: (err) => {
        this.isSyncing.set(false);
        const msg =
          err.status === 403
            ? 'Acesso negado: apenas DONO ou GERENTE podem sincronizar.'
            : 'Erro ao contatar o servidor de sincronização.';
        this.snackBar.open(msg, 'Fechar', { duration: 5000 });
      },
    });
  }
}
