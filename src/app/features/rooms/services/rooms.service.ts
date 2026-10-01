import { Injectable, computed, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Room,
  RoomStatus,
  RoomEvent,
  RoomStatusChangedEvent,
  RoomCreateRequest,
  RoomUpdateRequest,
} from '../models/room.model';
import { AuthSignalService } from '../../../core/services/auth-signal.service';
import { API_BASE_URL } from '../../../core/config/api.config';

@Injectable({
  providedIn: 'root',
})
export class RoomsService implements OnDestroy {
  private http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private authService = inject(AuthSignalService);

  // State Signals
  private _roomsMap = signal<Map<number, Room>>(new Map());
  private _loading = signal<boolean>(false);
  private _connected = signal<boolean>(false);
  private _error = signal<string | null>(null);

  // Public readonly Signals
  readonly rooms = computed(() => Array.from(this._roomsMap().values()));
  readonly loading = this._loading.asReadonly();
  readonly connected = this._connected.asReadonly();
  readonly error = this._error.asReadonly();

  // SSE State
  private eventSource: EventSource | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentBackoff = 1000;
  private readonly maxBackoff = 30000;
  private isIntentionalDisconnect = false;
  private connecting = false;
  // Id do último evento recebido: na reconexão, o backend reenvia o que veio depois dele (T-48)
  private lastEventId: string | null = null;

  loadRooms(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http.get<Room[]>(`${this.api}/rooms`).subscribe({
      next: (data) => {
        const map = new Map<number, Room>();
        data.forEach((room) => map.set(room.id, room));
        this._roomsMap.set(map);
        this._loading.set(false);
      },
      error: () => {
        this._error.set('Erro ao carregar os quartos.');
        this._loading.set(false);
      },
    });
  }

  updateRoomStatus(roomId: number, status: RoomStatus): Observable<Room> {
    return this.http.patch<Room>(`${this.api}/rooms/${roomId}/status`, { status });
  }

  createRoom(payload: RoomCreateRequest): Observable<Room> {
    return new Observable<Room>((observer) => {
      this.http.post<Room>(`${this.api}/rooms`, payload).subscribe({
        next: (newRoom) => {
          this._roomsMap.update((map) => {
            const newMap = new Map(map);
            newMap.set(newRoom.id, newRoom);
            return newMap;
          });
          observer.next(newRoom);
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  updateRoomMetadata(roomId: number, payload: RoomUpdateRequest): Observable<Room> {
    return new Observable<Room>((observer) => {
      this.http.put<Room>(`${this.api}/rooms/${roomId}`, payload).subscribe({
        next: (updatedRoom) => {
          this._roomsMap.update((map) => {
            const newMap = new Map(map);
            newMap.set(updatedRoom.id, updatedRoom);
            return newMap;
          });
          observer.next(updatedRoom);
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  connectToStream(): void {
    if (this.eventSource || this._connected() || this.connecting) {
      return;
    }

    if (!this.authService.accessToken()) {
      this._error.set('Não autorizado. Faça login novamente.');
      return;
    }

    this.isIntentionalDisconnect = false;
    this.connecting = true;

    // O EventSource não envia headers: em vez do JWT na URL (vaza em logs e histórico), um ticket
    // opaco de uso único, válido por 30 s, pedido com o Bearer pelo HttpClient (T-19).
    // A cada reconexão um ticket novo é pedido, porque o anterior já foi consumido.
    this.http.post<{ ticket: string }>(`${this.api}/rooms/events/ticket`, {}).subscribe({
      next: ({ ticket }) => {
        this.connecting = false;
        if (this.isIntentionalDisconnect) return;
        const resume = this.lastEventId
          ? `&last_event_id=${encodeURIComponent(this.lastEventId)}`
          : '';
        this.openEventSource(
          `${this.api}/rooms/events?ticket=${encodeURIComponent(ticket)}${resume}`,
        );
      },
      error: () => {
        this.connecting = false;
        if (!this.isIntentionalDisconnect) this.scheduleReconnect();
      },
    });
  }

  private openEventSource(url: string): void {
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this._connected.set(true);
      this._error.set(null);
      this.currentBackoff = 1000;

      // Sincronizar quartos para não perder eventos que ocorreram enquanto desconectado
      this.loadRooms();
    };

    this.eventSource.onmessage = (event) => {
      if (event.lastEventId) this.lastEventId = event.lastEventId;
      try {
        this.handleEvent(JSON.parse(event.data) as RoomEvent);
      } catch (err) {
        console.error('Falha ao parsear mensagem SSE', err);
      }
    };

    this.eventSource.onerror = () => {
      this._connected.set(false);
      this.eventSource?.close();
      this.eventSource = null;

      // EventSource tem reconexão nativa, mas para ter backoff exponencial nós controlamos
      if (!this.isIntentionalDisconnect) {
        this.scheduleReconnect();
      }
    };
  }

  /** Aplica um evento do stream ao mapa de quartos (T-35: inclui criação e renomeação). */
  handleEvent(event: RoomEvent): void {
    switch (event.event_type) {
      case 'room_status_changed':
        this.handleStatusChanged(event);
        break;
      case 'room_created':
        // O evento não traz categoria nem capacidade: recarrega a lista para ter o quarto completo
        if (!this._roomsMap().has(event.room_id)) this.loadRooms();
        break;
      case 'room_metadata_updated':
        this.patchRoom(event.room_id, { number: event.new_number });
        break;
    }
  }

  private patchRoom(roomId: number, changes: Partial<Room>): void {
    this._roomsMap.update((map) => {
      const room = map.get(roomId);
      if (!room) return map;
      const newMap = new Map(map);
      newMap.set(roomId, { ...room, ...changes });
      return newMap;
    });
  }

  private handleStatusChanged(event: RoomStatusChangedEvent): void {
    this._roomsMap.update((map) => {
      const room = map.get(event.room_id);
      if (room) {
        const newMap = new Map(map);
        newMap.set(room.id, { ...room, status: event.new_status });
        return newMap;
      }
      return map;
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    // Limite máximo de backoff
    if (this.currentBackoff >= this.maxBackoff) {
      this._error.set('Conexão perdida. Tentando reconectar...');
    }

    this.reconnectTimeoutId = setTimeout(() => {
      this.currentBackoff = Math.min(this.currentBackoff * 2, this.maxBackoff);
      this.connectToStream();
    }, this.currentBackoff);
  }

  disconnect(): void {
    this.isIntentionalDisconnect = true;
    this._connected.set(false);
    this.lastEventId = null;

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
