import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  takeUntil,
  tap,
  filter,
} from 'rxjs/operators';
import { of } from 'rxjs';

import { GuestService, Guest } from '../../../core/services/guest.service';
import { cpfValidator, onlyDigits } from '../../../core/utils/cpf';
import { startOfToday } from '../../../core/utils/date.utils';
import { ReservationsService } from '../services/reservations.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-new-reservation-stepper',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatIconModule,
    RouterModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stepper-container">
      <header
        style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px;"
      >
        <h2>Criar Nova Reserva</h2>
        <button mat-icon-button routerLink="/admin/reservations">
          <mat-icon>close</mat-icon>
        </button>
      </header>
      <mat-stepper linear #stepper>
        <!-- Passo 1: Identificação do Hóspede -->
        <mat-step [stepControl]="guestFormGroup">
          <form [formGroup]="guestFormGroup">
            <ng-template matStepLabel>Hóspede</ng-template>

            <div class="form-row">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>CPF</mat-label>
                <input
                  matInput
                  formControlName="cpf"
                  placeholder="000.000.000-00"
                  maxlength="14"
                  required
                />
                @if (isSearchingCpf()) {
                  <mat-spinner matSuffix diameter="20"></mat-spinner>
                }
              </mat-form-field>
            </div>

            @if (foundGuest()) {
              <div class="guest-card">
                <strong>Hóspede Localizado:</strong> {{ foundGuest()?.full_name }}
              </div>
            } @else if (guestFormGroup.get('cpf')?.valid && !isSearchingCpf()) {
              <div class="guest-card not-found">
                <strong>Hóspede não encontrado.</strong>
                <p>Informe o nome completo para cadastrá-lo com a reserva.</p>
              </div>
              <div class="form-row">
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>Nome completo</mat-label>
                  <input matInput formControlName="fullName" id="guest-full-name" required />
                  @if (guestFormGroup.hasError('guestNameRequired')) {
                    <mat-error>Informe o nome completo (mínimo de 3 letras).</mat-error>
                  }
                </mat-form-field>
              </div>
            }
            @if (guestFormGroup.get('cpf')?.hasError('cpf')) {
              <p class="field-error" role="alert">CPF inválido.</p>
            }

            <div class="actions">
              <button
                mat-flat-button
                color="primary"
                matStepperNext
                [disabled]="guestFormGroup.invalid || isSearchingCpf()"
              >
                Próximo
              </button>
            </div>
          </form>
        </mat-step>

        <!-- Passo 2: Período e Quarto -->
        <mat-step [stepControl]="reservationFormGroup">
          <form [formGroup]="reservationFormGroup">
            <ng-template matStepLabel>Reserva</ng-template>

            <div class="form-row dates-row">
              <mat-form-field appearance="outline">
                <mat-label>Check-in</mat-label>
                <input
                  matInput
                  [matDatepicker]="pickerIn"
                  [min]="today"
                  formControlName="checkIn"
                  required
                />
                <mat-hint>MM/DD/YYYY</mat-hint>
                <mat-datepicker-toggle matIconSuffix [for]="pickerIn"></mat-datepicker-toggle>
                <mat-datepicker #pickerIn></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Check-out</mat-label>
                <input
                  matInput
                  [matDatepicker]="pickerOut"
                  [min]="minCheckOut()"
                  formControlName="checkOut"
                  required
                />
                <mat-hint>MM/DD/YYYY</mat-hint>
                <mat-datepicker-toggle matIconSuffix [for]="pickerOut"></mat-datepicker-toggle>
                <mat-datepicker #pickerOut></mat-datepicker>
              </mat-form-field>
            </div>

            @if (reservationFormGroup.hasError('checkInPast')) {
              <p class="field-error" role="alert">O check-in não pode ser no passado.</p>
            }
            @if (reservationFormGroup.hasError('checkOutBeforeCheckIn')) {
              <p class="field-error" role="alert">O check-out deve ser depois do check-in.</p>
            }

            <div class="form-row">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Quarto (ID)</mat-label>
                <input matInput type="number" formControlName="roomId" required />
              </mat-form-field>
            </div>

            <div class="actions">
              <button mat-button matStepperPrevious [disabled]="isSubmitting()">Voltar</button>
              <button
                mat-flat-button
                color="primary"
                (click)="submitReservation()"
                [disabled]="reservationFormGroup.invalid || isSubmitting()"
              >
                @if (isSubmitting()) {
                  <mat-spinner
                    diameter="20"
                    style="margin-right: 8px; display: inline-block; vertical-align: middle;"
                  ></mat-spinner>
                }
                Confirmar Reserva
              </button>
            </div>
          </form>
        </mat-step>
      </mat-stepper>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 800px;
        margin: 0 auto;
      }
      .stepper-container {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }
      .form-row {
        margin-bottom: 16px;
        margin-top: 16px;
      }
      .dates-row {
        display: flex;
        gap: 16px;
      }
      .w-full {
        width: 100%;
      }
      .guest-card {
        padding: 16px;
        background: var(--color-available-bg, #f0fdf4);
        border: 1px solid var(--color-available, #15803d);
        border-radius: 4px;
        margin-bottom: 16px;
      }
      .field-error {
        color: #b91c1c;
        margin: 0 0 8px;
      }
      .guest-card.not-found {
        background: var(--color-maintenance-bg, #fef3c7);
        border-color: var(--color-maintenance, #92400e);
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 24px;
      }
    `,
  ],
})
export class NewReservationStepperComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private guestService = inject(GuestService);
  private reservationsService = inject(ReservationsService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  private destroy$ = new Subject<void>();

  // Signals para UI State
  isSearchingCpf = signal(false);
  foundGuest = signal<Guest | null>(null);

  // Forms
  readonly today = startOfToday();

  // Hóspede novo precisa de nome: o backend gravava "Não Informado" (T-32)
  private guestNameValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
    if (this.foundGuest()) return null;
    const name = (group.get('fullName')?.value ?? '').trim();
    return name.length >= 3 ? null : { guestNameRequired: true };
  };

  private dateRangeValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
    const checkIn = group.get('checkIn')?.value as Date | null;
    const checkOut = group.get('checkOut')?.value as Date | null;
    if (checkIn && checkIn < this.today) return { checkInPast: true };
    if (checkIn && checkOut && checkOut <= checkIn) return { checkOutBeforeCheckIn: true };
    return null;
  };

  guestFormGroup = this.fb.nonNullable.group(
    {
      cpf: ['', [Validators.required, cpfValidator]],
      fullName: [''],
    },
    { validators: this.guestNameValidator },
  );

  reservationFormGroup = this.fb.nonNullable.group(
    {
      checkIn: [null as Date | null, Validators.required],
      checkOut: [null as Date | null, Validators.required],
      roomId: [null as number | null, Validators.required],
    },
    { validators: this.dateRangeValidator },
  );

  minCheckOut(): Date {
    const checkIn = this.reservationFormGroup.get('checkIn')?.value;
    const base = checkIn ?? this.today;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  }

  ngOnInit() {
    this.setupCpfSearch();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupCpfSearch() {
    this.guestFormGroup
      .get('cpf')
      ?.valueChanges.pipe(
        takeUntil(this.destroy$),
        // Filtra CPFs vazios
        filter((cpf) => !!cpf && cpf.replace(/\D/g, '').length === 11),
        // Delay para evitar requisições a cada tecla
        debounceTime(300),
        // Evita mesma busca
        distinctUntilChanged(),
        tap(() => {
          this.isSearchingCpf.set(true);
          this.foundGuest.set(null);
        }),
        // SwitchMap cancela a request anterior se uma nova chegar
        switchMap((cpf) =>
          this.guestService.checkGuestByCpf(cpf).pipe(
            tap(() => this.isSearchingCpf.set(false)),
            catchError(() => {
              this.isSearchingCpf.set(false);
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((guest: Guest | null) => {
        this.isSearchingCpf.set(false);
        this.foundGuest.set(guest);
        // O nome passa a ser exigido (ou não) conforme o hóspede exista
        this.guestFormGroup.updateValueAndValidity();
      });
  }

  isSubmitting = signal(false);

  submitReservation() {
    if (this.reservationFormGroup.invalid || this.guestFormGroup.invalid) {
      return;
    }

    const { checkIn, checkOut, roomId } = this.reservationFormGroup.getRawValue();
    const { cpf, fullName } = this.guestFormGroup.getRawValue();
    const guest = this.foundGuest();

    const payload = {
      room_id: Number(roomId),
      guest_cpf: onlyDigits(guest ? guest.cpf : cpf),
      guest_full_name: guest ? guest.full_name : fullName.trim(),
      check_in: checkIn as Date,
      check_out: checkOut as Date,
      status: 'CONFIRMED',
    };

    this.isSubmitting.set(true);

    this.reservationsService.createReservation(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.snackBar.open('Reserva criada com sucesso!', 'OK', { duration: 3000 });
        this.router.navigate(['/admin/rooms']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err.status === 409) {
          this.snackBar.open(
            'Overbooking detectado: Este quarto já está reservado no período.',
            'Fechar',
            { duration: 5000 },
          );
        } else if (err.status === 422 || err.status === 400) {
          this.snackBar.open(validationMessage(err.error), 'Fechar', { duration: 5000 });
        } else {
          this.snackBar.open('Erro ao criar reserva. Tente novamente.', 'Fechar', {
            duration: 3000,
          });
        }
      },
    });
  }
}

/** Mensagem do 400/422 do backend (detail em texto ou lista do Pydantic), sem detalhes técnicos. */
export function validationMessage(error: unknown): string {
  const detail = (error as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const msg = String((detail[0] as { msg?: string }).msg ?? '');
    return msg.replace(/^Value error, /, '') || 'Dados da reserva inválidos.';
  }
  return 'Dados da reserva inválidos.';
}
