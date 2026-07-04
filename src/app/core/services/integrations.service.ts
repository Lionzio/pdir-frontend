import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface SyncResponse {
  status: string;
  message: string;
  initiated_by: string;
}

@Injectable({
  providedIn: 'root',
})
export class IntegrationsService {
  private http = inject(HttpClient);

  forceSheetsSync(): Observable<SyncResponse> {
    return this.http.post<SyncResponse>('/api/v1/integrations/sheets/sync', {});
  }
}
