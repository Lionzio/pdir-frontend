import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { AccountStatement, Transaction } from '../../finance/models/finance.model';
import { FinanceService } from '../../finance/services/finance.service';
import { ReservationsService } from '../services/reservations.service';
import {
  ReservationDetailData,
  ReservationDetailDialogComponent,
} from './reservation-detail-dialog.component';

const statement = (balance: string): AccountStatement => ({
  id: 70,
  reservation_id: 5,
  status: 'OPEN',
  total_charges: '300.00',
  total_paid: (300 - Number(balance)).toFixed(2),
  balance,
  due_date: null,
  created_at: '2099-01-01T00:00:00Z',
  updated_at: '2099-01-01T00:00:00Z',
  transactions: [],
});

describe('ReservationDetailDialogComponent (T-40)', () => {
  let fixture: ComponentFixture<ReservationDetailDialogComponent>;
  let reservations: jasmine.SpyObj<ReservationsService>;
  let finance: jasmine.SpyObj<FinanceService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<ReservationDetailDialogComponent>>;

  const open = (status: string) => {
    const data: ReservationDetailData = {
      id: 5,
      guestName: 'Maria Fictícia',
      roomNumber: '101',
      checkIn: '2099-01-01',
      checkOut: '2099-01-03',
      status,
    };
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: data });
    fixture = TestBed.createComponent(ReservationDetailDialogComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const click = (selector: string) => {
    (fixture.nativeElement.querySelector(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    reservations = jasmine.createSpyObj('ReservationsService', ['checkIn', 'checkOut']);
    finance = jasmine.createSpyObj('FinanceService', [
      'getStatementByReservation',
      'addTransaction',
    ]);
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    finance.getStatementByReservation.and.returnValue(of(statement('0.00')));

    await TestBed.configureTestingModule({
      imports: [ReservationDetailDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: ReservationsService, useValue: reservations },
        { provide: FinanceService, useValue: finance },
      ],
    }).compileComponents();
  });

  it('reserva confirmada: check-in chama a API e mostra a conta aberta', () => {
    reservations.checkIn.and.returnValue(of({ id: 5, room_id: 1, status: 'CHECKED_IN' }));
    const el = open('CONFIRMED');
    expect(el.querySelector('.btn-check-out')).toBeNull();

    click('.btn-check-in');

    expect(reservations.checkIn).toHaveBeenCalledWith(5);
    expect(finance.getStatementByReservation).toHaveBeenCalledWith(5);
    expect(el.querySelector('.btn-check-out')).not.toBeNull();
    expect(el.querySelector('.balance')?.textContent).toMatch(/R\$\s?0[.,]00/); // formato depende do LOCALE_ID
  });

  it('check-out com saldo devedor (409) mostra o motivo e o formulário de pagamento', () => {
    finance.getStatementByReservation.and.returnValue(of(statement('120.50')));
    reservations.checkOut.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'Check-out bloqueado: a conta 70 tem saldo devedor de R$ 120.50.' },
          }),
      ),
    );
    const el = open('CHECKED_IN');

    click('.btn-check-out');

    expect(el.querySelector('.message')?.textContent).toContain('saldo devedor de R$ 120.50');
    expect(el.querySelector('.btn-pay')).not.toBeNull();
    expect(fixture.componentInstance.status()).toBe('CHECKED_IN');
  });

  it('registrar pagamento lança um crédito com o saldo e recarrega a conta', () => {
    finance.getStatementByReservation.and.returnValue(of(statement('120.50')));
    finance.addTransaction.and.returnValue(of({ id: 1 } as unknown as Transaction));
    open('CHECKED_IN');
    finance.getStatementByReservation.calls.reset();

    fixture.componentInstance.registerPayment();

    expect(finance.addTransaction).toHaveBeenCalledWith(
      70,
      jasmine.objectContaining({
        transaction_type: 'CREDIT',
        category: 'PAGAMENTO_CHECKOUT',
        amount: '120.50',
      }),
    );
    expect(finance.getStatementByReservation).toHaveBeenCalledTimes(1);
  });

  it('check-out quitado conclui e avisa a tela para recarregar', () => {
    reservations.checkOut.and.returnValue(of({ id: 5, room_id: 1, status: 'CHECKED_OUT' }));
    open('CHECKED_IN');

    click('.btn-check-out');
    fixture.componentInstance.close();

    expect(fixture.componentInstance.status()).toBe('CHECKED_OUT');
    expect(dialogRef.close).toHaveBeenCalledWith({ changed: true });
  });

  it('reserva sem conta (404) não mostra erro', () => {
    finance.getStatementByReservation.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    const el = open('CHECKED_IN');
    expect(el.querySelector('.message')).toBeNull();
  });
});
