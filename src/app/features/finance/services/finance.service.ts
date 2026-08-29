import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  Account,
  AccountCloseRequest,
  AccountCloseResponse,
  AccountStatement,
  InvoiceSummary,
  MaturityStatus,
  RefundRequest,
  RefundResponse,
  Transaction,
  TransactionCreateRequest,
} from '../models/finance.model';

@Injectable({
  providedIn: 'root',
})
export class FinanceService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/finance';

  /**
   * Abre (ou retorna) a conta financeira para a reserva informada.
   */
  openAccount(reservationId: number): Observable<Account> {
    return this.http.post<Account>(`${this.baseUrl}/accounts/reservation/${reservationId}`, {});
  }

  /**
   * Lança um débito ou crédito em uma conta aberta.
   */
  addTransaction(accountId: number, payload: TransactionCreateRequest): Observable<Transaction> {
    return this.http.post<Transaction>(
      `${this.baseUrl}/accounts/${accountId}/transactions`,
      payload,
    );
  }

  /**
   * Retorna o extrato completo com todas as transações da conta.
   */
  getStatement(accountId: number): Observable<AccountStatement> {
    return this.http.get<AccountStatement>(`${this.baseUrl}/accounts/${accountId}/statement`);
  }

  /**
   * Encerra a conta financeira do hóspede com pagamento opcional no checkout.
   */
  closeAccount(accountId: number, payload: AccountCloseRequest): Observable<AccountCloseResponse> {
    return this.http.post<AccountCloseResponse>(
      `${this.baseUrl}/accounts/${accountId}/close`,
      payload,
    );
  }

  /**
   * Estorna uma transação financeira (exclusivo DONO).
   */
  refundTransaction(transactionId: number, payload: RefundRequest): Observable<RefundResponse> {
    return this.http.post<RefundResponse>(
      `${this.baseUrl}/transactions/${transactionId}/refund`,
      payload,
    );
  }

  /**
   * Lista faturas com filtro opcional por status de inadimplência.
   */
  listInvoices(
    maturityStatus?: MaturityStatus,
    page = 1,
    pageSize = 50,
  ): Observable<InvoiceSummary[]> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());

    if (maturityStatus) {
      params = params.set('maturity_status', maturityStatus);
    }

    return this.http.get<InvoiceSummary[]>(`${this.baseUrl}/invoices`, {
      params,
    });
  }
}
