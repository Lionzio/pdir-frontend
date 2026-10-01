import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Só os dígitos do CPF ("529.982.247-25" → "52998224725"). */
export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

/** CPF com 11 dígitos, não repetidos, e os dois dígitos verificadores corretos (mesma regra do backend, T-21). */
export function isValidCpf(value: string | null | undefined): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const numbers = digits.split('').map(Number);
  for (const size of [9, 10]) {
    let total = 0;
    for (let i = 0; i < size; i++) total += numbers[i] * (size + 1 - i);
    if (((total * 10) % 11) % 10 !== numbers[size]) return false;
  }
  return true;
}

export const cpfValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  !control.value || isValidCpf(control.value) ? null : { cpf: true };
