import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { FinanceService } from './finance.service';
import type {
  Account,
  AccountCloseResponse,
  AccountStatement,
  InvoiceSummary,
  RefundResponse,
  Transaction,
} from '../models/finance.model';

describe('FinanceService', () => {
  let service: FinanceService;
  let httpMock: HttpTestingController;

  const mockAccount: Account = {
    id: 1,
    reservation_id: 42,
    status: 'OPEN',
    total_charges: '0.00',
    total_paid: '0.00',
    balance: '0.00',
    due_date: null,
    created_at: '2026-08-29T00:00:00Z',
    updated_at: '2026-08-29T00:00:00Z',
  };

  const mockTransaction: Transaction = {
    id: 10,
    account_id: 1,
    transaction_type: 'DEBIT',
    category: 'FRIGOBAR',
    amount: '45.50',
    description: 'Consumo de minibar',
    created_by_user_id: 7,
    original_transaction_id: null,
    refund_reason: null,
    is_refunded: false,
    created_at: '2026-08-29T10:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FinanceService],
    });
    service = TestBed.inject(FinanceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('openAccount', () => {
    it('should POST to /api/v1/finance/accounts/reservation/:id', () => {
      service.openAccount(42).subscribe((account) => {
        expect(account.reservation_id).toBe(42);
        expect(account.status).toBe('OPEN');
      });

      const req = httpMock.expectOne('/api/v1/finance/accounts/reservation/42');
      expect(req.request.method).toBe('POST');
      req.flush(mockAccount);
    });
  });

  describe('addTransaction', () => {
    it('should POST to /api/v1/finance/accounts/:id/transactions', () => {
      const payload = {
        transaction_type: 'DEBIT' as const,
        category: 'FRIGOBAR' as const,
        amount: '45.50',
        description: 'Consumo de minibar',
      };

      service.addTransaction(1, payload).subscribe((txn) => {
        expect(txn.id).toBe(10);
        expect(txn.amount).toBe('45.50');
      });

      const req = httpMock.expectOne('/api/v1/finance/accounts/1/transactions');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(mockTransaction);
    });
  });

  describe('getStatement', () => {
    it('should GET /api/v1/finance/accounts/:id/statement', () => {
      const mockStatement: AccountStatement = {
        ...mockAccount,
        transactions: [mockTransaction],
      };

      service.getStatement(1).subscribe((stmt) => {
        expect(stmt.transactions.length).toBe(1);
        expect(stmt.transactions[0].category).toBe('FRIGOBAR');
      });

      const req = httpMock.expectOne('/api/v1/finance/accounts/1/statement');
      expect(req.request.method).toBe('GET');
      req.flush(mockStatement);
    });
  });

  describe('closeAccount', () => {
    it('should POST to /api/v1/finance/accounts/:id/close', () => {
      const payload = {
        payment_amount: '300.00',
        payment_description: 'Pagamento no checkout',
      };
      const mockResponse: AccountCloseResponse = {
        id: 1,
        reservation_id: 42,
        status: 'CLOSED',
        total_charges: '300.00',
        total_paid: '300.00',
        balance: '0.00',
        change_amount: '0.00',
        message: 'Conta encerrada com sucesso.',
      };

      service.closeAccount(1, payload).subscribe((resp) => {
        expect(resp.status).toBe('CLOSED');
        expect(resp.balance).toBe('0.00');
      });

      const req = httpMock.expectOne('/api/v1/finance/accounts/1/close');
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);
    });
  });

  describe('refundTransaction', () => {
    it('should POST to /api/v1/finance/transactions/:id/refund', () => {
      const payload = { reason: 'Cobrança indevida verificada pelo dono da unidade.' };
      const mockRefund: RefundResponse = {
        refund_transaction_id: 20,
        original_transaction_id: 10,
        amount_refunded: '45.50',
        reason: payload.reason,
        message: 'Estorno processado com sucesso.',
      };

      service.refundTransaction(10, payload).subscribe((resp) => {
        expect(resp.refund_transaction_id).toBe(20);
        expect(resp.amount_refunded).toBe('45.50');
      });

      const req = httpMock.expectOne('/api/v1/finance/transactions/10/refund');
      expect(req.request.method).toBe('POST');
      req.flush(mockRefund);
    });
  });

  describe('listInvoices', () => {
    it('should GET /api/v1/finance/invoices without filter', () => {
      const mockInvoices: InvoiceSummary[] = [
        {
          account_id: 1,
          reservation_id: 42,
          guest_name: 'João Silva',
          room_number: '201',
          balance: '150.00',
          total_charges: '300.00',
          total_paid: '150.00',
          due_date: '2026-09-01',
          maturity_status: 'GREEN',
          account_status: 'OPEN',
        },
      ];

      service.listInvoices().subscribe((invoices) => {
        expect(invoices.length).toBe(1);
        expect(invoices[0].maturity_status).toBe('GREEN');
      });

      const req = httpMock.expectOne((r) => r.url === '/api/v1/finance/invoices');
      expect(req.request.method).toBe('GET');
      req.flush(mockInvoices);
    });

    it('should include maturity_status query param when filter provided', () => {
      service.listInvoices('RED').subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/v1/finance/invoices' && r.params.get('maturity_status') === 'RED',
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should include pagination params', () => {
      service.listInvoices(undefined, 2, 25).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/v1/finance/invoices' &&
          r.params.get('page') === '2' &&
          r.params.get('page_size') === '25',
      );
      req.flush([]);
    });
  });
});
