import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { IntegrationsService } from '../../../core/services/integrations.service';

@Component({
  selector: 'app-sync-panel',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressBarModule],
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
            <div class="status-indicator">
              <mat-icon class="status-icon success">check_circle</mat-icon>
              <span>Conexão Estabelecida (Polling Automático: 5 min)</span>
            </div>

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
export class SyncPanelComponent {
  private integrationsService = inject(IntegrationsService);
  private snackBar = inject(MatSnackBar);

  isSyncing = signal(false);

  triggerEmergencySync(): void {
    this.isSyncing.set(true);

    this.integrationsService.forceSheetsSync().subscribe({
      next: (response) => {
        this.snackBar.open(response.message, 'OK', {
          duration: 5000,
          panelClass: ['success-snackbar'],
        });
        // Simula o tempo de processamento em background para feedback visual
        setTimeout(() => this.isSyncing.set(false), 2500);
      },
      error: (err) => {
        this.isSyncing.set(false);
        const msg =
          err.status === 403
            ? 'Acesso negado: Você não tem permissão de Dono.'
            : 'Erro ao contatar o servidor de sincronização.';
        this.snackBar.open(msg, 'Fechar', { duration: 5000 });
      },
    });
  }
}
