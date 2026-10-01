import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';

import { IamService, UserStatus, UserSummary } from '../../../core/services/iam.service';

type Decision = Extract<UserStatus, 'APPROVED' | 'REJECTED'>;

/** Fila de cadastros aguardando aprovação do gestor (T-39). */
@Component({
  selector: 'app-approvals-page',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, RouterLink],
  template: `
    <section class="approvals">
      <header>
        <button mat-icon-button routerLink="/admin/rooms" aria-label="Voltar">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Cadastros aguardando aprovação</h1>
      </header>

      @if (loading()) {
        <mat-spinner diameter="32"></mat-spinner>
      } @else if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      } @else if (pending().length === 0) {
        <p class="empty">Nenhum cadastro pendente.</p>
      } @else {
        <ul class="pending-list">
          @for (user of pending(); track user.id) {
            <li class="pending-item">
              <div class="who">
                <strong>{{ user.full_name }}</strong>
                <span>{{ user.email }} · {{ user.role }}</span>
              </div>
              <div class="actions">
                <button
                  mat-flat-button
                  color="primary"
                  class="btn-approve"
                  [disabled]="busyId() === user.id"
                  (click)="decide(user, 'APPROVED')"
                >
                  Aprovar
                </button>
                <button
                  mat-stroked-button
                  color="warn"
                  class="btn-reject"
                  [disabled]="busyId() === user.id"
                  (click)="decide(user, 'REJECTED')"
                >
                  Rejeitar
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .approvals {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px 16px;
      }
      header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pending-list {
        list-style: none;
        padding: 0;
      }
      .pending-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 1px solid #e5e7eb;
      }
      .who {
        display: flex;
        flex-direction: column;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .error {
        color: #b91c1c;
      }
    `,
  ],
})
export class ApprovalsPageComponent implements OnInit {
  private iam = inject(IamService);
  private snackBar = inject(MatSnackBar);

  pending = signal<UserSummary[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  busyId = signal<number | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.iam.listByStatus('PENDING_APPROVAL').subscribe({
      next: (users) => {
        this.pending.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível carregar os cadastros pendentes.');
        this.loading.set(false);
      },
    });
  }

  decide(user: UserSummary, status: Decision): void {
    this.busyId.set(user.id);
    this.iam.updateStatus(user.id, status).subscribe({
      next: () => {
        this.pending.update((list) => list.filter((u) => u.id !== user.id));
        this.busyId.set(null);
        const verb = status === 'APPROVED' ? 'aprovado' : 'rejeitado';
        this.snackBar.open(`Cadastro de ${user.full_name} ${verb}.`, 'OK', { duration: 3000 });
      },
      error: (err: { error?: { detail?: unknown } }) => {
        this.busyId.set(null);
        const detail = typeof err.error?.detail === 'string' ? err.error.detail : null;
        this.snackBar.open(detail ?? 'Não foi possível atualizar o cadastro.', 'Fechar', {
          duration: 5000,
        });
      },
    });
  }
}
