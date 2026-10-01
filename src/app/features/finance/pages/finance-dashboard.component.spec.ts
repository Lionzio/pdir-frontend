import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { AuthSignalService } from '../../../core/services/auth-signal.service';
import { FinanceService } from '../services/finance.service';
import type { AccountStatement } from '../models/finance.model';
import { FinanceDashboardComponent } from './finance-dashboard.component';

const STATEMENT: AccountStatement = {
  id: 1,
  reservation_id: 10,
  status: 'OPEN',
  total_charges: '100.00',
  total_paid: '40.00',
  balance: '60.00',
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  transactions: [
    {
      id: 7,
      account_id: 1,
      transaction_type: 'DEBIT',
      category: 'FRIGOBAR',
      amount: '100.00',
      description: 'Frigobar',
      created_by_user_id: 1,
      original_transaction_id: null,
      refund_reason: null,
      is_refunded: false,
      created_at: '2026-10-01T12:00:00Z',
    },
  ],
};

function render(role: string) {
  const roleSignal = signal<string | null>(role);
  TestBed.configureTestingModule({
    imports: [FinanceDashboardComponent, NoopAnimationsModule],
    providers: [
      { provide: FinanceService, useValue: { listInvoices: () => of([]) } },
      {
        provide: AuthSignalService,
        useValue: {
          role: roleSignal,
          hasRole: (roles: string[]) => roles.includes(roleSignal() ?? ''),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(FinanceDashboardComponent);
  fixture.detectChanges();
  fixture.componentInstance.currentStatement.set(STATEMENT);
  fixture.componentInstance.showStatementModal.set(true);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FinanceDashboardComponent · extrato', () => {
  // Botão só com ícone: sem aria-label, leitor de tela (e o E2E FC7) não acha o estorno.
  it('botão de estorno tem nome acessível para o DONO', () => {
    const el = render('DONO');
    const refund = el.querySelector('button[aria-label="Estornar transação"]');
    expect(refund).not.toBeNull();
  });

  it('estorno não aparece para a recepção', () => {
    const el = render('RECEPCIONISTA');
    expect(el.querySelector('button[aria-label="Estornar transação"]')).toBeNull();
  });
});

describe('FinanceDashboardComponent · limites dos valores (os mesmos da API, T-88)', () => {
  // render() configura o módulo de teste; o fixture novo dá acesso direto aos formulários
  const forms = () => {
    render('GERENTE');
    const fixture = TestBed.createComponent(FinanceDashboardComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('lançamento e pagamento acima de R$ 99.999.999,99 são inválidos', () => {
    const { transactionForm, checkoutForm } = forms();

    transactionForm.get('amount')!.setValue('100000000.00');
    checkoutForm.get('payment_amount')!.setValue('100000000.00');
    expect(transactionForm.get('amount')!.hasError('max')).toBeTrue();
    expect(checkoutForm.get('payment_amount')!.hasError('max')).toBeTrue();

    transactionForm.get('amount')!.setValue('99999999.99');
    checkoutForm.get('payment_amount')!.setValue('99999999.99');
    expect(transactionForm.get('amount')!.valid).toBeTrue();
    expect(checkoutForm.get('payment_amount')!.valid).toBeTrue();
  });

  it('valores com mais de 2 casas decimais são inválidos, como na API (T-90)', () => {
    const { transactionForm, checkoutForm } = forms();
    const amount = transactionForm.get('amount')!;
    const payment = checkoutForm.get('payment_amount')!;

    amount.setValue(10.005);
    payment.setValue(0.001);
    expect(amount.hasError('pattern')).toBeTrue();
    expect(payment.hasError('pattern')).toBeTrue();

    amount.setValue(10.5);
    payment.setValue('0.00');
    expect(amount.valid).toBeTrue();
    expect(payment.valid).toBeTrue();
  });

  it('descrição do lançamento tem no máximo 500 caracteres', () => {
    const description = forms().transactionForm.get('description')!;

    description.setValue('x'.repeat(501));
    expect(description.hasError('maxlength')).toBeTrue();
    description.setValue('x'.repeat(500));
    expect(description.valid).toBeTrue();
  });
});
