import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { RbacAllowDirective } from '../../../core/directives/rbac-allow.directive';
import { FinanceService } from '../services/finance.service';
import {
  CATEGORY_LABELS,
  MATURITY_DISPLAY,
  MaturityStatus,
  type InvoiceSummary,
  type AccountStatement,
  type TransactionCreateRequest,
  type AccountCloseRequest,
} from '../models/finance.model';

type FilterOption = MaturityStatus | 'ALL';

@Component({
  selector: 'app-finance-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    RbacAllowDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="finance-dashboard">
      <!-- Header -->
      <div class="dashboard-header">
        <h1 class="dashboard-title">
          <mat-icon>account_balance_wallet</mat-icon>
          Módulo Financeiro
        </h1>
        <div class="dashboard-actions">
          <button mat-stroked-button (click)="loadInvoices()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon>
            Atualizar
          </button>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filter-bar">
        @for (option of filterOptions; track option.value) {
          <button
            mat-flat-button
            [class.active-filter]="currentFilter() === option.value"
            [style.background-color]="
              option.value !== 'ALL' ? maturityDisplay[option.value]?.color + '20' : ''
            "
            (click)="setFilter(option.value)"
          >
            {{ option.label }}
          </button>
        }
      </div>

      <!-- Spinner -->
      @if (loading()) {
        <div class="loading-center">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      }

      <!-- Kanban Board -->
      @if (!loading()) {
        <div class="kanban-board">
          @for (col of kanbanColumns; track col.status) {
            <div class="kanban-col" [class]="maturityDisplay[col.status].bgClass">
              <div class="kanban-col-header">
                <span class="kanban-col-title" [style.color]="maturityDisplay[col.status].color">
                  {{ maturityDisplay[col.status].label }}
                </span>
                <span class="kanban-col-count">
                  {{ getInvoicesForStatus(col.status).length }}
                </span>
              </div>

              <div class="kanban-cards">
                @for (invoice of getInvoicesForStatus(col.status); track invoice.account_id) {
                  <mat-card class="invoice-card" [class]="maturityDisplay[col.status].borderClass">
                    <mat-card-header>
                      <mat-card-title class="invoice-guest">
                        {{ invoice.guest_name || 'Hóspede não identificado' }}
                      </mat-card-title>
                      <mat-card-subtitle>
                        Quarto {{ invoice.room_number || '—' }} · Reserva #{{
                          invoice.reservation_id
                        }}
                      </mat-card-subtitle>
                    </mat-card-header>

                    <mat-card-content>
                      <div class="invoice-amounts">
                        <div class="amount-row">
                          <span class="amount-label">Débitos:</span>
                          <span class="amount-value debit">
                            R$ {{ formatMoney(invoice.total_charges) }}
                          </span>
                        </div>
                        <div class="amount-row">
                          <span class="amount-label">Pagamentos:</span>
                          <span class="amount-value credit">
                            R$ {{ formatMoney(invoice.total_paid) }}
                          </span>
                        </div>
                        <div class="amount-row balance-row">
                          <span class="amount-label">Saldo:</span>
                          <span
                            class="amount-value balance"
                            [class.balance-negative]="parseAmount(invoice.balance) > 0"
                          >
                            R$ {{ formatMoney(invoice.balance) }}
                          </span>
                        </div>
                        @if (invoice.due_date) {
                          <div class="amount-row">
                            <span class="amount-label">Vencimento:</span>
                            <span class="amount-value">{{ invoice.due_date }}</span>
                          </div>
                        }
                      </div>

                      <div class="invoice-status">
                        <mat-chip
                          [class]="invoice.account_status === 'OPEN' ? 'chip-open' : 'chip-closed'"
                        >
                          {{ invoice.account_status === 'OPEN' ? 'Aberta' : 'Encerrada' }}
                        </mat-chip>
                      </div>
                    </mat-card-content>

                    <mat-card-actions>
                      @if (invoice.account_status === 'OPEN') {
                        <button
                          mat-button
                          color="primary"
                          (click)="openTransactionModal(invoice)"
                          matTooltip="Lançar consumo"
                        >
                          <mat-icon>add_shopping_cart</mat-icon>
                          Lançar
                        </button>
                        <button
                          mat-button
                          (click)="openStatementModal(invoice)"
                          matTooltip="Ver extrato e checkout"
                        >
                          <mat-icon>receipt</mat-icon>
                          Extrato
                        </button>
                      } @else {
                        <button mat-button (click)="openStatementModal(invoice)">
                          <mat-icon>receipt_long</mat-icon>
                          Ver Extrato
                        </button>
                      }
                    </mat-card-actions>
                  </mat-card>
                }

                @if (getInvoicesForStatus(col.status).length === 0) {
                  <div class="empty-col">
                    <mat-icon>check_circle_outline</mat-icon>
                    <p>Nenhuma conta</p>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Modal: Lançamento Rápido -->
      @if (showTransactionModal()) {
        <div
          class="modal-overlay"
          role="presentation"
          (click)="closeModals()"
          (keydown.escape)="closeModals()"
        >
          <div
            class="modal-panel"
            role="dialog"
            aria-modal="true"
            tabindex="0"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <div class="modal-header">
              <h2>Lançar Consumo</h2>
              <button mat-icon-button (click)="closeModals()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form [formGroup]="transactionForm" (ngSubmit)="submitTransaction()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Tipo</mat-label>
                <mat-select formControlName="transaction_type">
                  <mat-option value="DEBIT">Débito (Consumo)</mat-option>
                  <mat-option value="CREDIT">Crédito (Pagamento Antecipado)</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Categoria</mat-label>
                <mat-select formControlName="category">
                  @for (cat of categoryOptions; track cat.value) {
                    <mat-option [value]="cat.value">{{ cat.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Valor (R$)</mat-label>
                <input matInput type="number" step="0.01" min="0.01" formControlName="amount" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Descrição</mat-label>
                <input matInput formControlName="description" />
              </mat-form-field>

              <div class="modal-actions">
                <button mat-button type="button" (click)="closeModals()">Cancelar</button>
                <button
                  mat-flat-button
                  color="primary"
                  type="submit"
                  [disabled]="transactionForm.invalid || submitting()"
                >
                  {{ submitting() ? 'Processando...' : 'Lançar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Modal: Extrato e Checkout -->
      @if (showStatementModal() && currentStatement()) {
        <div
          class="modal-overlay"
          role="presentation"
          (click)="closeModals()"
          (keydown.escape)="closeModals()"
        >
          <div
            class="modal-panel modal-large"
            role="dialog"
            aria-modal="true"
            tabindex="0"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <div class="modal-header">
              <h2>Extrato da Conta #{{ currentStatement()!.id }}</h2>
              <button mat-icon-button (click)="closeModals()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="statement-summary">
              <div class="summary-row">
                <span>Total de Débitos:</span>
                <strong class="debit"
                  >R$ {{ formatMoney(currentStatement()!.total_charges) }}</strong
                >
              </div>
              <div class="summary-row">
                <span>Total de Pagamentos:</span>
                <strong class="credit">R$ {{ formatMoney(currentStatement()!.total_paid) }}</strong>
              </div>
              <div class="summary-row balance-summary">
                <span>Saldo Devedor:</span>
                <strong [class.balance-negative]="parseAmount(currentStatement()!.balance) > 0">
                  R$ {{ formatMoney(currentStatement()!.balance) }}
                </strong>
              </div>
            </div>

            <div class="transaction-list">
              <h3>Transações</h3>
              @for (txn of currentStatement()!.transactions; track txn.id) {
                <div class="txn-row" [class.txn-refunded]="txn.is_refunded">
                  <div class="txn-info">
                    <span class="txn-category">{{ categoryLabels[txn.category] }}</span>
                    <span class="txn-desc">{{ txn.description }}</span>
                    @if (txn.is_refunded) {
                      <span class="txn-refund-badge">ESTORNADO</span>
                    }
                  </div>
                  <div class="txn-amount-col">
                    <span
                      class="txn-amount"
                      [class.debit]="txn.transaction_type === 'DEBIT'"
                      [class.credit]="
                        txn.transaction_type === 'CREDIT' || txn.transaction_type === 'REFUND'
                      "
                    >
                      {{ txn.transaction_type === 'DEBIT' ? '-' : '+' }}R$
                      {{ formatMoney(txn.amount) }}
                    </span>
                    <!-- Estorno: exclusivo DONO -->
                    <ng-container *appRbacAllow="['DONO']">
                      @if (!txn.is_refunded && txn.transaction_type !== 'REFUND') {
                        <button
                          mat-icon-button
                          color="warn"
                          matTooltip="Estornar transação"
                          aria-label="Estornar transação"
                          (click)="openRefundDialog(txn.id)"
                        >
                          <mat-icon>undo</mat-icon>
                        </button>
                      }
                    </ng-container>
                  </div>
                </div>
              }
            </div>

            <!-- Checkout -->
            @if (currentStatement()!.status === 'OPEN') {
              <div class="checkout-section">
                <h3>Fechar Conta (Checkout)</h3>
                <form [formGroup]="checkoutForm" (ngSubmit)="submitCheckout()">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Valor Recebido do Hóspede (R$)</mat-label>
                    <input
                      matInput
                      type="number"
                      step="0.01"
                      min="0"
                      formControlName="payment_amount"
                    />
                  </mat-form-field>

                  <div class="checkout-preview">
                    <span
                      >Saldo devedor:
                      <strong>R$ {{ formatMoney(currentStatement()!.balance) }}</strong></span
                    >
                  </div>

                  <button
                    mat-flat-button
                    color="primary"
                    type="submit"
                    [disabled]="
                      checkoutForm.invalid ||
                      submitting() ||
                      parseAmount(currentStatement()!.balance) >
                        parseFloat(checkoutForm.value.payment_amount || '0')
                    "
                  >
                    {{ submitting() ? 'Processando...' : 'Fechar Conta' }}
                  </button>
                  @if (
                    parseAmount(currentStatement()!.balance) > 0 &&
                    parseFloat(checkoutForm.value.payment_amount || '0') <
                      parseAmount(currentStatement()!.balance)
                  ) {
                    <p class="balance-warning">⚠️ O valor informado é inferior ao saldo devedor.</p>
                  }
                </form>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .finance-dashboard {
        padding: 24px;
        max-width: 1400px;
        margin: 0 auto;
      }
      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .dashboard-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.5rem;
        margin: 0;
      }
      .filter-bar {
        display: flex;
        gap: 8px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      .active-filter {
        border: 2px solid currentColor !important;
        font-weight: 700;
      }
      .loading-center {
        display: flex;
        justify-content: center;
        padding: 48px;
      }
      .kanban-board {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        align-items: start;
      }
      @media (max-width: 1100px) {
        .kanban-board {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 600px) {
        .kanban-board {
          grid-template-columns: 1fr;
        }
      }
      .kanban-col {
        border-radius: 8px;
        padding: 12px;
        min-height: 200px;
      }
      .kanban-col--green {
        background: #e8f5e9;
      }
      .kanban-col--yellow {
        background: #fff8e1;
      }
      .kanban-col--orange {
        background: #fff3e0;
      }
      .kanban-col--red {
        background: #ffebee;
      }
      .kanban-col-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .kanban-col-title {
        font-weight: 700;
        font-size: 0.9rem;
      }
      .kanban-col-count {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 0.8rem;
        font-weight: 600;
      }
      .kanban-cards {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .invoice-card {
        border-left: 4px solid transparent;
        font-size: 0.85rem;
      }
      .border-green {
        border-left-color: #2e7d32 !important;
      }
      .border-yellow {
        border-left-color: #f57f17 !important;
      }
      .border-orange {
        border-left-color: #e65100 !important;
      }
      .border-red {
        border-left-color: #b71c1c !important;
      }
      .invoice-guest {
        font-size: 0.9rem !important;
      }
      .invoice-amounts {
        margin-top: 8px;
      }
      .amount-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-size: 0.82rem;
      }
      .amount-label {
        color: #666;
      }
      .amount-value {
        font-weight: 500;
      }
      .debit {
        color: #c62828;
      }
      .credit {
        color: #2e7d32;
      }
      .balance-row {
        margin-top: 8px;
        border-top: 1px solid #eee;
        padding-top: 8px;
      }
      .balance {
        font-weight: 700;
      }
      .balance-negative {
        color: #c62828;
      }
      .invoice-status {
        margin-top: 8px;
      }
      .chip-open {
        background: #e3f2fd !important;
      }
      .chip-closed {
        background: #f5f5f5 !important;
      }
      .empty-col {
        text-align: center;
        padding: 32px 16px;
        color: #999;
      }
      .empty-col mat-icon {
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
      }
      /* Modal */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-panel {
        background: white;
        border-radius: 8px;
        padding: 24px;
        width: 100%;
        max-width: 480px;
        max-height: 90vh;
        overflow-y: auto;
      }
      .modal-large {
        max-width: 680px;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .modal-header h2 {
        margin: 0;
      }
      .full-width {
        width: 100%;
        margin-bottom: 12px;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
      .statement-summary {
        background: #f5f5f5;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .balance-summary {
        border-top: 1px solid #ddd;
        padding-top: 8px;
        margin-top: 8px;
      }
      .transaction-list {
        max-height: 240px;
        overflow-y: auto;
        margin-bottom: 16px;
      }
      .transaction-list h3 {
        margin-bottom: 8px;
      }
      .txn-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
      }
      .txn-refunded {
        opacity: 0.55;
      }
      .txn-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .txn-category {
        font-weight: 600;
        font-size: 0.82rem;
      }
      .txn-desc {
        font-size: 0.78rem;
        color: #666;
      }
      .txn-refund-badge {
        font-size: 0.7rem;
        color: #b71c1c;
        font-weight: 700;
        letter-spacing: 0.05em;
      }
      .txn-amount-col {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .txn-amount {
        font-weight: 600;
        font-size: 0.9rem;
      }
      .checkout-section {
        border-top: 1px solid #ddd;
        padding-top: 16px;
      }
      .checkout-preview {
        margin-bottom: 12px;
        color: #555;
      }
      .balance-warning {
        color: #c62828;
        font-size: 0.82rem;
        margin-top: 8px;
      }
    `,
  ],
})
export class FinanceDashboardComponent implements OnInit, OnDestroy {
  private financeService = inject(FinanceService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  // State signals
  loading = signal(false);
  submitting = signal(false);
  invoices = signal<InvoiceSummary[]>([]);
  currentFilter = signal<FilterOption>('ALL');
  showTransactionModal = signal(false);
  showStatementModal = signal(false);
  currentStatement = signal<AccountStatement | null>(null);
  selectedAccountId = signal<number | null>(null);

  // Display helpers
  readonly maturityDisplay = MATURITY_DISPLAY;
  readonly categoryLabels = CATEGORY_LABELS;

  readonly kanbanColumns: { status: MaturityStatus }[] = [
    { status: 'GREEN' },
    { status: 'YELLOW' },
    { status: 'ORANGE' },
    { status: 'RED' },
  ];

  readonly filterOptions: { value: FilterOption; label: string }[] = [
    { value: 'ALL', label: 'Todas' },
    { value: 'GREEN', label: '🟢 Normal' },
    { value: 'YELLOW', label: '🟡 Alerta' },
    { value: 'ORANGE', label: '🟠 Bloqueado' },
    { value: 'RED', label: '🔴 Inadimplente' },
  ];

  readonly categoryOptions = Object.entries(CATEGORY_LABELS)
    .filter(([value]) => !['PAGAMENTO_CHECKOUT', 'PAGAMENTO_ANTECIPADO'].includes(value))
    .map(([value, label]) => ({ value, label }));

  // Forms
  transactionForm!: FormGroup;
  checkoutForm!: FormGroup;

  ngOnInit(): void {
    this.transactionForm = this.fb.group({
      transaction_type: ['DEBIT', Validators.required],
      category: ['FRIGOBAR', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      description: ['', [Validators.required, Validators.minLength(1)]],
    });

    this.checkoutForm = this.fb.group({
      payment_amount: ['0.00', [Validators.required, Validators.min(0)]],
    });

    this.loadInvoices();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInvoices(): void {
    this.loading.set(true);
    const filter =
      this.currentFilter() !== 'ALL' ? (this.currentFilter() as MaturityStatus) : undefined;
    this.financeService
      .listInvoices(filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.invoices.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open('Erro ao carregar faturas.', 'OK', { duration: 3000 });
        },
      });
  }

  setFilter(value: FilterOption): void {
    this.currentFilter.set(value);
    this.loadInvoices();
  }

  getInvoicesForStatus(status: MaturityStatus): InvoiceSummary[] {
    return this.invoices().filter((i) => i.maturity_status === status);
  }

  openTransactionModal(invoice: InvoiceSummary): void {
    this.selectedAccountId.set(invoice.account_id);
    this.transactionForm.reset({
      transaction_type: 'DEBIT',
      category: 'FRIGOBAR',
      amount: '',
      description: '',
    });
    this.showTransactionModal.set(true);
  }

  openStatementModal(invoice: InvoiceSummary): void {
    this.selectedAccountId.set(invoice.account_id);
    this.financeService
      .getStatement(invoice.account_id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stmt) => {
          this.currentStatement.set(stmt);
          this.checkoutForm.reset({ payment_amount: '0.00' });
          this.showStatementModal.set(true);
        },
        error: () => {
          this.snackBar.open('Erro ao carregar extrato.', 'OK', { duration: 3000 });
        },
      });
  }

  closeModals(): void {
    this.showTransactionModal.set(false);
    this.showStatementModal.set(false);
    this.currentStatement.set(null);
    this.selectedAccountId.set(null);
  }

  submitTransaction(): void {
    if (this.transactionForm.invalid || !this.selectedAccountId()) return;

    this.submitting.set(true);
    const payload: TransactionCreateRequest = {
      ...this.transactionForm.value,
      amount: String(this.transactionForm.value.amount),
    };

    this.financeService
      .addTransaction(this.selectedAccountId()!, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Lançamento registrado com sucesso!', 'OK', { duration: 2500 });
          this.submitting.set(false);
          this.closeModals();
          this.loadInvoices();
        },
        error: (err) => {
          this.submitting.set(false);
          const msg = err?.error?.detail || 'Erro ao registrar lançamento.';
          this.snackBar.open(msg, 'OK', { duration: 4000 });
        },
      });
  }

  submitCheckout(): void {
    if (!this.selectedAccountId() || !this.currentStatement()) return;

    this.submitting.set(true);
    const payload: AccountCloseRequest = {
      payment_amount: String(this.checkoutForm.value.payment_amount ?? '0.00'),
      payment_description: 'Pagamento no checkout',
    };

    this.financeService
      .closeAccount(this.selectedAccountId()!, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          const changeMsg =
            parseFloat(response.change_amount) > 0
              ? ` Troco: R$ ${this.formatMoney(response.change_amount)}`
              : '';
          this.snackBar.open(`Conta encerrada com sucesso!${changeMsg}`, 'OK', { duration: 4000 });
          this.closeModals();
          this.loadInvoices();
        },
        error: (err) => {
          this.submitting.set(false);
          const msg = err?.error?.detail || 'Erro ao fechar conta.';
          this.snackBar.open(msg, 'OK', { duration: 4000 });
        },
      });
  }

  openRefundDialog(transactionId: number): void {
    const reason = prompt('Digite a justificativa do estorno (mínimo 10 caracteres):');
    if (!reason || reason.trim().length < 10) {
      this.snackBar.open('Justificativa insuficiente. Mínimo 10 caracteres.', 'OK', {
        duration: 3000,
      });
      return;
    }

    this.financeService
      .refundTransaction(transactionId, { reason: reason.trim() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Estorno realizado com sucesso.', 'OK', { duration: 3000 });
          // Recarregar extrato
          if (this.selectedAccountId()) {
            this.financeService.getStatement(this.selectedAccountId()!).subscribe((stmt) => {
              this.currentStatement.set(stmt);
            });
          }
          this.loadInvoices();
        },
        error: (err) => {
          const msg = err?.error?.detail || 'Erro ao processar estorno.';
          this.snackBar.open(msg, 'OK', { duration: 4000 });
        },
      });
  }

  formatMoney(value: string | number): string {
    return Number(value).toFixed(2);
  }

  parseAmount(value: string | number): number {
    return Number(value);
  }

  parseFloat(value: string): number {
    return parseFloat(value) || 0;
  }
}
