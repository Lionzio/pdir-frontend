import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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

  forceSheetsSync(): Observable<SyncResponse> {
    return this.http.post<SyncResponse>('/api/v1/integrations/sheets/sync', {});
  }

  getSheetsStatus(): Observable<SheetsSyncStatus> {
    return this.http.get<SheetsSyncStatus>('/api/v1/integrations/sheets/status');
  }
}
