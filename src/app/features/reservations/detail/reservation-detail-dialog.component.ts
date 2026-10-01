import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';

import { AccountStatement } from '../../finance/models/finance.model';
import { FinanceService } from '../../finance/services/finance.service';
import { ReservationsService } from '../services/reservations.service';

export interface ReservationDetailData {
  id: number;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

/** Resultado ao fechar: `changed` pede para a tela recarregar as reservas. */
export interface ReservationDetailResult {
  changed: boolean;
}

/**
 * Ciclo da reserva pela interface (T-40): check-in, check-out e conta do hóspede.
 * O check-in abre a conta no backend; o check-out com saldo devedor responde 409 (T-22).
 */
@Component({
  selector: 'app-reservation-detail-dialog',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Reserva #{{ data.id }} · Quarto {{ data.roomNumber }}</h2>
    <mat-dialog-content>
      <p class="guest"><mat-icon>person</mat-icon> {{ data.guestName }}</p>
      <p>
        {{ data.checkIn | date: 'dd/MM/yyyy' }} → {{ data.checkOut | date: 'dd/MM/yyyy' }} ·
        <strong class="status">{{ statusLabel(status()) }}</strong>
      </p>

      @if (message(); as text) {
        <p class="message" role="alert">{{ text }}</p>
      }

      <div class="lifecycle">
        @if (status() === 'CONFIRMED') {
          <button
            mat-flat-button
            color="primary"
            class="btn-check-in"
            [disabled]="busy()"
            (click)="checkIn()"
          >
            <mat-icon>login</mat-icon> Fazer check-in
          </button>
        }
        @if (status() === 'CHECKED_IN') {
          <button
            mat-flat-button
            color="primary"
            class="btn-check-out"
            [disabled]="busy()"
            (click)="checkOut()"
          >
            <mat-icon>logout</mat-icon> Fazer check-out
          </button>
        }
      </div>

      @if (statement(); as account) {
        <section class="account">
          <h3>Conta do hóspede</h3>
          <p class="totals">
            Cobrado: {{ toNumber(account.total_charges) | currency: 'BRL' }} · Pago:
            {{ toNumber(account.total_paid) | currency: 'BRL' }} ·
            <strong class="balance"
              >Saldo: {{ toNumber(account.balance) | currency: 'BRL' }}</strong
            >
          </p>
          @if (account.transactions.length > 0) {
            <ul class="transactions">
              @for (t of account.transactions; track t.id) {
                <li>
                  {{ t.created_at | date: 'dd/MM HH:mm' }} · {{ t.transaction_type }} ·
                  {{ t.category }} · {{ toNumber(t.amount) | currency: 'BRL' }}
                </li>
              }
            </ul>
          } @else {
            <p class="empty">Sem lançamentos.</p>
          }

          @if (status() === 'CHECKED_IN' && toNumber(account.balance) > 0) {
            <form class="payment" (ngSubmit)="registerPayment()">
              <mat-form-field appearance="outline">
                <mat-label>Valor do pagamento (R$)</mat-label>
                <input
                  matInput
                  type="number"
                  min="0.01"
                  step="0.01"
                  name="paymentAmount"
                  [(ngModel)]="paymentAmount"
                  required
                />
              </mat-form-field>
              <button
                mat-stroked-button
                type="submit"
                class="btn-pay"
                [disabled]="busy() || !(paymentAmount > 0)"
              >
                Registrar pagamento
              </button>
            </form>
          }
        </section>
      }
      @if (busy()) {
        <mat-spinner diameter="24"></mat-spinner>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Fechar</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .guest {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
      }
      .lifecycle {
        display: flex;
        gap: 8px;
        margin: 12px 0;
      }
      .message {
        color: #92400e;
        background: #fef3c7;
        padding: 8px 12px;
        border-radius: 4px;
      }
      .transactions {
        padding-left: 1.2rem;
        font-size: 13px;
      }
      .payment {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    `,
  ],
})
export class ReservationDetailDialogComponent implements OnInit {
  readonly data = inject<ReservationDetailData>(MAT_DIALOG_DATA);
  private dialogRef =
    inject<MatDialogRef<ReservationDetailDialogComponent, ReservationDetailResult>>(MatDialogRef);
  private reservations = inject(ReservationsService);
  private finance = inject(FinanceService);

  status = signal(this.data.status);
  statement = signal<AccountStatement | null>(null);
  message = signal<string | null>(null);
  busy = signal(false);
  paymentAmount = 0;
  private changed = false;

  ngOnInit(): void {
    if (this.status() === 'CHECKED_IN' || this.status() === 'CHECKED_OUT') this.loadStatement();
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      CONFIRMED: 'Confirmada',
      CHECKED_IN: 'Hospedado',
      CHECKED_OUT: 'Check-out feito',
      CANCELLED: 'Cancelada',
    };
    return labels[status] ?? status;
  }

  /** Valores monetários chegam como texto (Decimal) para não perder precisão. */
  toNumber(value: string): number {
    return Number(value);
  }

  loadStatement(): void {
    this.finance.getStatementByReservation(this.data.id).subscribe({
      next: (account) => {
        this.statement.set(account);
        this.paymentAmount = Math.max(Number(account.balance), 0);
      },
      error: (err: HttpErrorResponse) => {
        // 404 = reserva sem conta (anterior à abertura automática no check-in)
        if (err.status !== 404) this.message.set('Não foi possível carregar a conta.');
      },
    });
  }

  checkIn(): void {
    this.run(this.reservations.checkIn(this.data.id), () => {
      this.status.set('CHECKED_IN');
      this.message.set(null);
      this.loadStatement();
    });
  }

  checkOut(): void {
    this.run(this.reservations.checkOut(this.data.id), () => {
      this.status.set('CHECKED_OUT');
      this.message.set(null);
      this.loadStatement();
    });
  }

  registerPayment(): void {
    const account = this.statement();
    if (!account || !(this.paymentAmount > 0)) return;
    const payload = {
      transaction_type: 'CREDIT' as const,
      category: 'PAGAMENTO_CHECKOUT' as const,
      amount: this.paymentAmount.toFixed(2),
      description: 'Pagamento registrado na recepção',
    };
    this.run(this.finance.addTransaction(account.id, payload), () => {
      this.message.set(null);
      this.loadStatement();
    });
  }

  close(): void {
    this.dialogRef.close({ changed: this.changed });
  }

  private run(request: Observable<unknown>, onSuccess: () => void): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.changed = true;
        onSuccess();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        const detail = typeof err.error?.detail === 'string' ? err.error.detail : null;
        this.message.set(detail ?? 'Não foi possível concluir a operação.');
        // 409 do check-out = saldo devedor: o extrato atualizado mostra quanto falta pagar
        if (err.status === 409) this.loadStatement();
      },
    });
  }
}
