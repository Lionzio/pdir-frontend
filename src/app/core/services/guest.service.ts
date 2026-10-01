import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_BASE_URL } from '../../core/config/api.config';

export interface Guest {
  id: number;
  full_name: string;
  cpf: string;
  email?: string;
  phone?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GuestService {
  private http = inject(HttpClient);
  private apiUrl = `${inject(API_BASE_URL)}/guests`;

  /**
   * Busca um hóspede pelo CPF no PostgreSQL via API.
   *
   * @param cpf string numérica de 11 caracteres ou formatada
   * @returns Observable com Guest ou nulo caso não exista (HTTP 404)
   */
  checkGuestByCpf(cpf: string): Observable<Guest | null> {
    const rawCpf = cpf.replace(/\D/g, '');

    if (rawCpf.length !== 11) {
      return of(null);
    }

    return this.http.get<Guest>(`${this.apiUrl}/cpf/${rawCpf}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }
        return throwError(() => error);
      }),
    );
  }
}
