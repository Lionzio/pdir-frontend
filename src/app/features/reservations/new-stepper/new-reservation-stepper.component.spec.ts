import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { GuestService } from '../../../core/services/guest.service';
import { Reservation, ReservationsService } from '../services/reservations.service';
import {
  NewReservationStepperComponent,
  validationMessage,
} from './new-reservation-stepper.component';

const VALID_CPF = '529.982.247-25';

describe('NewReservationStepperComponent (T-32)', () => {
  let fixture: ComponentFixture<NewReservationStepperComponent>;
  let component: NewReservationStepperComponent;
  let reservations: jasmine.SpyObj<ReservationsService>;

  const daysFromToday = (days: number) => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  };

  beforeEach(async () => {
    reservations = jasmine.createSpyObj('ReservationsService', ['createReservation']);
    reservations.createReservation.and.returnValue(of({ id: 1 } as unknown as Reservation));
    const guests = jasmine.createSpyObj('GuestService', ['checkGuestByCpf']);
    guests.checkGuestByCpf.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [NewReservationStepperComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ReservationsService, useValue: reservations },
        { provide: GuestService, useValue: guests },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewReservationStepperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hóspede novo sem nome deixa o passo inválido', () => {
    component.guestFormGroup.patchValue({ cpf: VALID_CPF, fullName: '' });
    expect(component.guestFormGroup.hasError('guestNameRequired')).toBeTrue();
    expect(component.guestFormGroup.invalid).toBeTrue();

    component.guestFormGroup.patchValue({ fullName: 'Maria Fictícia' });
    expect(component.guestFormGroup.valid).toBeTrue();
  });

  it('hóspede já cadastrado dispensa o nome', () => {
    component.foundGuest.set({
      id: 1,
      cpf: '52998224725',
      full_name: 'Hóspede Existente',
    } as never);
    component.guestFormGroup.patchValue({ cpf: VALID_CPF, fullName: '' });
    expect(component.guestFormGroup.valid).toBeTrue();
  });

  it('CPF com dígito verificador errado é inválido', () => {
    component.guestFormGroup.patchValue({ cpf: '529.982.247-24', fullName: 'Maria Fictícia' });
    expect(component.guestFormGroup.get('cpf')?.hasError('cpf')).toBeTrue();
  });

  it('check-in no passado é inválido', () => {
    component.reservationFormGroup.patchValue({
      checkIn: daysFromToday(-1),
      checkOut: daysFromToday(2),
      roomId: 1,
    });
    expect(component.reservationFormGroup.hasError('checkInPast')).toBeTrue();
  });

  it('check-out igual ao check-in é inválido', () => {
    component.reservationFormGroup.patchValue({
      checkIn: daysFromToday(3),
      checkOut: daysFromToday(3),
      roomId: 1,
    });
    expect(component.reservationFormGroup.hasError('checkOutBeforeCheckIn')).toBeTrue();
  });

  it('envia nome digitado e CPF só com dígitos (nunca "Não Informado")', () => {
    component.guestFormGroup.patchValue({ cpf: VALID_CPF, fullName: '  Maria Fictícia ' });
    component.reservationFormGroup.patchValue({
      checkIn: daysFromToday(1),
      checkOut: daysFromToday(3),
      roomId: 7,
    });

    component.submitReservation();

    const payload = reservations.createReservation.calls.mostRecent().args[0];
    expect(payload.guest_cpf).toBe('52998224725');
    expect(payload.guest_full_name).toBe('Maria Fictícia');
    expect(payload.room_id).toBe(7);
  });

  it('mensagem do 422 vem do detail do backend', () => {
    expect(validationMessage({ detail: [{ msg: 'Value error, CPF inválido.' }] })).toBe(
      'CPF inválido.',
    );
    expect(validationMessage({ detail: 'Quarto fora de operação.' })).toBe(
      'Quarto fora de operação.',
    );
    expect(validationMessage(null)).toBe('Dados da reserva inválidos.');
  });
});
