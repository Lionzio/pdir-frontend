import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';

export interface SyncResponse {
  status: string;
  message: string;
  initiated_by: string;
}

/** GET /integrations/sheets/status (backend T-26). */
export interface SheetsSyncStatus {
  last_sync: { finished_at: string; stats: Record<string, number> } | null;
  retry_queue_size: number;
  recent_failures: { timestamp: string; direction: string; description: string | null }[];
}

@Injectable({
  providedIn: 'root',
})
export class IntegrationsService {
  private http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  forceSheetsSync(): Observable<SyncResponse> {
    return this.http.post<SyncResponse>(`${this.api}/integrations/sheets/sync`, {});
  }

  getSheetsStatus(): Observable<SheetsSyncStatus> {
    return this.http.get<SheetsSyncStatus>(`${this.api}/integrations/sheets/status`);
  }
}
