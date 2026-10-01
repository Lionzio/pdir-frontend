import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';

export type UserStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

/** Funcionário como o backend lista em GET /iam/users (sem senha nem hash) — T-39. */
export interface UserSummary {
  id: number;
  email: string;
  full_name: string;
  role: string;
  status: UserStatus;
}

@Injectable({ providedIn: 'root' })
export class IamService {
  private http = inject(HttpClient);
  private apiUrl = `${inject(API_BASE_URL)}/iam/users`;

  listByStatus(status: UserStatus): Observable<UserSummary[]> {
    const params = new HttpParams().set('status', status).set('page_size', 200);
    return this.http.get<UserSummary[]>(this.apiUrl, { params });
  }

  updateStatus(userId: number, status: UserStatus): Observable<unknown> {
    return this.http.patch(`${this.apiUrl}/${userId}/status`, { status });
  }
}
