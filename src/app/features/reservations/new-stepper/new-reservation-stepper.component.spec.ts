import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
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
  let guests: jasmine.SpyObj<GuestService>;

  const daysFromToday = (days: number) => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  };

  beforeEach(async () => {
    reservations = jasmine.createSpyObj('ReservationsService', ['createReservation']);
    reservations.createReservation.and.returnValue(of({ id: 1 } as unknown as Reservation));
    guests = jasmine.createSpyObj('GuestService', ['checkGuestByCpf']);
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

  const OTHER_VALID_CPF = '111.444.777-35';
  const nextButton = () =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Próximo'),
    )!;

  it('hóspede novo sem nome deixa o passo inválido', fakeAsync(() => {
    component.guestFormGroup.patchValue({ cpf: VALID_CPF, fullName: '' });
    tick(300); // busca: não existe
    expect(component.guestFormGroup.hasError('guestNameRequired')).toBeTrue();
    expect(component.guestFormGroup.invalid).toBeTrue();

    component.guestFormGroup.patchValue({ fullName: 'Maria Fictícia' });
    expect(component.guestFormGroup.valid).toBeTrue();
  }));

  it('hóspede já cadastrado dispensa o nome', fakeAsync(() => {
    guests.checkGuestByCpf.and.returnValue(
      of({ id: 1, cpf: '52998224725', full_name: 'Hóspede Existente' }),
    );
    component.guestFormGroup.patchValue({ cpf: VALID_CPF, fullName: '' });
    tick(300);
    expect(component.guestFormGroup.valid).toBeTrue();
  }));

  // E2E FC4: quando o campo de nome some (o hóspede do novo CPF existe), o controle não pode ficar
  // preso como inválido por um validador que só existia enquanto o campo estava na tela.
  it('trocar para um CPF de hóspede cadastrado tira o campo de nome e libera o "Próximo"', fakeAsync(() => {
    component.guestFormGroup.get('cpf')!.setValue(VALID_CPF);
    tick(300); // não existe: campo de nome obrigatório na tela
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#guest-full-name')).not.toBeNull();
    expect(nextButton().disabled).toBeTrue();

    guests.checkGuestByCpf.and.returnValue(
      of({ id: 1, cpf: '11144477735', full_name: 'Hóspede Existente' }),
    );
    component.guestFormGroup.get('cpf')!.setValue(OTHER_VALID_CPF);
    tick(300);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#guest-full-name')).toBeNull();
    expect(component.guestFormGroup.valid).toBeTrue();
    expect(nextButton().disabled).toBeFalse();
  }));

  it('campo de nome do hóspede novo é anunciado como obrigatório', fakeAsync(() => {
    component.guestFormGroup.get('cpf')!.setValue(VALID_CPF);
    tick(300);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#guest-full-name');
    expect(input.getAttribute('aria-required')).toBe('true');
  }));

  it('nome curto de hóspede novo mostra o erro depois de tocado', fakeAsync(() => {
    component.guestFormGroup.patchValue({ cpf: VALID_CPF, fullName: 'Al' });
    tick(300);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#guest-full-name');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Informe o nome completo');
  }));

  // E2E smoke (instável): antes da busca, a tela já dizia "não encontrado" e o "Próximo" habilitava; quando a
  // busca começava, o campo sumia e o botão desabilitava, e um clique nessa janela não avançava o passo.
  it('antes da busca do CPF terminar, não afirma "não encontrado" nem libera o "Próximo"', fakeAsync(() => {
    component.guestFormGroup.get('cpf')!.setValue(VALID_CPF);
    component.guestFormGroup.get('fullName')!.setValue('Maria Fictícia');
    fixture.detectChanges(); // debounce de 300 ms ainda correndo: a busca nem começou

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Hóspede não encontrado');
    expect(el.querySelector('#guest-full-name')).toBeNull();
    expect(component.guestFormGroup.valid).toBeFalse();
    expect(nextButton().disabled).toBeTrue();

    tick(300); // busca termina: hóspede não existe
    fixture.detectChanges();
    expect(el.textContent).toContain('Hóspede não encontrado');
    expect(el.querySelector('#guest-full-name')).not.toBeNull();
    expect(nextButton().disabled).toBeFalse();
  }));

  it('trocar o CPF depois da busca volta a esperar a nova busca', fakeAsync(() => {
    component.guestFormGroup.patchValue({ cpf: VALID_CPF, fullName: 'Maria Fictícia' });
    tick(300);
    expect(component.guestFormGroup.valid).toBeTrue();

    component.guestFormGroup.get('cpf')!.setValue(OTHER_VALID_CPF);
    expect(component.guestFormGroup.valid).toBeFalse();
    tick(300);
    expect(component.guestFormGroup.valid).toBeTrue();
  }));

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

  it('envia nome digitado e CPF só com dígitos (nunca "Não Informado")', fakeAsync(() => {
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.guestFormGroup.patchValue({ cpf: VALID_CPF, fullName: '  Maria Fictícia ' });
    tick(300);
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
  }));

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
