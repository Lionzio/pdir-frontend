import type { components } from '../../../core/api/schema';
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Room } from '../../rooms/models/room.model';
import { toIsoDate, toUtcIso8601 } from '../../../core/utils/date.utils';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface ReservationCreateRequest {
  room_id: number;
  guest_cpf: string;
  guest_full_name: string;
  check_in: string; // ISO-8601 UTC ou YYYY-MM-DD
  check_out: string; // ISO-8601 UTC ou YYYY-MM-DD
  status: string;
}

export interface Reservation {
  id: number;
  room_id: number;
  guest_id: number | null;
  /** Nome do hóspede (o backend nunca envia o CPF na listagem) — T-33 */
  guest_name?: string | null;
  check_in: string; // ISO-8601 UTC
  check_out: string; // ISO-8601 UTC
  status: string;
  total_price: number | null;
}

/** Resposta do check-in e do check-out (ReservationLifecycleResponse no OpenAPI). */
export type ReservationLifecycle = components['schemas']['ReservationLifecycleResponse'];

@Injectable({
  providedIn: 'root',
})
export class ReservationsService {
  private http = inject(HttpClient);
  private api = inject(API_BASE_URL);
  private apiUrl = `${this.api}/reservations`;

  /**
   * Cria uma reserva enviando os dados pro backend real.
   */
  createReservation(
    payload: Omit<ReservationCreateRequest, 'check_in' | 'check_out'> & {
      check_in: Date;
      check_out: Date;
    },
  ): Observable<Reservation> {
    // Datas sem hora (YYYY-MM-DD), como o contrato do backend; o CPF vai só com dígitos (T-32)
    const formattedPayload: ReservationCreateRequest = {
      ...payload,
      guest_cpf: payload.guest_cpf.replace(/\D/g, ''),
      check_in: toIsoDate(payload.check_in)!,
      check_out: toIsoDate(payload.check_out)!,
    };
    return this.http.post<Reservation>(this.apiUrl, formattedPayload);
  }

  /** Check-in: o backend abre a conta do hóspede na mesma transação (T-22). */
  checkIn(reservationId: number): Observable<ReservationLifecycle> {
    return this.http.post<ReservationLifecycle>(`${this.apiUrl}/${reservationId}/check-in`, {});
  }

  /** Check-out: 409 se a conta tiver saldo devedor (T-22). */
  checkOut(reservationId: number): Observable<ReservationLifecycle> {
    return this.http.post<ReservationLifecycle>(`${this.apiUrl}/${reservationId}/check-out`, {});
  }

  /**
   * Lista reservas reais do PostgreSQL com filtros temporais opcionais.
   */
  listReservations(startDate?: Date, endDate?: Date): Observable<Reservation[]> {
    let params = new HttpParams();
    if (startDate) {
      const isoStart = toUtcIso8601(startDate);
      if (isoStart) {
        params = params.set('start_date', isoStart.split('T')[0]);
      }
    }
    if (endDate) {
      const isoEnd = toUtcIso8601(endDate);
      if (isoEnd) {
        params = params.set('end_date', isoEnd.split('T')[0]);
      }
    }
    return this.http.get<Reservation[]>(this.apiUrl, { params });
  }

  /**
   * Lista quartos disponíveis no backend real para o intervalo [checkIn, checkOut).
   */
  listAvailableRooms(checkIn: Date, checkOut: Date): Observable<Room[]> {
    let params = new HttpParams();
    const isoIn = toUtcIso8601(checkIn);
    const isoOut = toUtcIso8601(checkOut);

    if (isoIn) {
      params = params.set('check_in', isoIn.split('T')[0]);
    }
    if (isoOut) {
      params = params.set('check_out', isoOut.split('T')[0]);
    }

    return this.http.get<Room[]>(`${this.api}/rooms/available`, { params });
  }
}
