import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthSignalService } from '../../../core/services/auth-signal.service';
import { Room } from '../models/room.model';
import { RoomsService } from './rooms.service';

/** EventSource falso: registra a URL e expõe os handlers para o teste. */
class FakeEventSource {
  static urls: string[] = [];
  static last: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string; lastEventId?: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = jasmine.createSpy('close');

  constructor(public url: string) {
    FakeEventSource.urls.push(url);
    FakeEventSource.last = this;
  }
}

describe('RoomsService — stream SSE com ticket (T-19)', () => {
  let service: RoomsService;
  let http: HttpTestingController;
  const ACCESS_TOKEN = 'jwt-que-nao-pode-ir-na-url';
  let originalEventSource: typeof EventSource;

  beforeEach(() => {
    FakeEventSource.urls = [];
    originalEventSource = window.EventSource;
    (window as unknown as { EventSource: unknown }).EventSource = FakeEventSource;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    TestBed.inject(AuthSignalService).updateSession(ACCESS_TOKEN, {
      sub: 'recepcao@exemplo.test',
      user_id: 3,
      role: 'RECEPCIONISTA',
      permissions: [],
    });
    service = TestBed.inject(RoomsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.disconnect();
    (window as unknown as { EventSource: unknown }).EventSource = originalEventSource;
    TestBed.inject(AuthSignalService).clearSession();
  });

  it('pede um ticket e abre o EventSource com ele, nunca com o JWT', () => {
    service.connectToStream();

    const ticketReq = http.expectOne('/api/v1/rooms/events/ticket');
    expect(ticketReq.request.method).toBe('POST');
    ticketReq.flush({ ticket: 'ticket-opaco', expires_in: 30 });

    expect(FakeEventSource.urls).toEqual(['/api/v1/rooms/events?ticket=ticket-opaco']);
    expect(FakeEventSource.urls[0]).not.toContain(ACCESS_TOKEN);
    expect(FakeEventSource.urls[0]).not.toContain('token=');
  });

  it('falha ao pedir o ticket não abre o stream', () => {
    service.connectToStream();
    http
      .expectOne('/api/v1/rooms/events/ticket')
      .flush('erro', { status: 503, statusText: 'Service Unavailable' });

    expect(FakeEventSource.urls).toEqual([]);
  });

  it('chamadas repetidas enquanto conecta pedem um único ticket', () => {
    service.connectToStream();
    service.connectToStream();

    http.expectOne('/api/v1/rooms/events/ticket').flush({ ticket: 'unico', expires_in: 30 });
    expect(FakeEventSource.urls.length).toBe(1);
  });

  describe('reconexão com o último id recebido (T-48)', () => {
    const statusEvent = JSON.stringify({
      event_type: 'room_status_changed',
      room_id: 1,
      room_number: '101',
      previous_status: 'AVAILABLE',
      new_status: 'CLEANING',
      changed_by: 'x',
      timestamp: '2099-01-01T00:00:00Z',
    });

    const open = (ticket: string) => {
      http.expectOne('/api/v1/rooms/events/ticket').flush({ ticket, expires_in: 30 });
      FakeEventSource.last!.onopen?.();
      http.expectOne('/api/v1/rooms').flush([]);
    };

    it('ao cair, reconecta pedindo os eventos posteriores ao último id', fakeAsync(() => {
      service.connectToStream();
      open('t1');
      FakeEventSource.last!.onmessage?.({ data: statusEvent, lastEventId: '1700000000000-3' });

      FakeEventSource.last!.onerror?.();
      tick(1000);
      http.expectOne('/api/v1/rooms/events/ticket').flush({ ticket: 't2', expires_in: 30 });

      expect(FakeEventSource.urls[1]).toBe(
        '/api/v1/rooms/events?ticket=t2&last_event_id=1700000000000-3',
      );
    }));

    it('desconexão intencional esquece o id: a próxima sessão começa do zero', () => {
      service.connectToStream();
      open('t1');
      FakeEventSource.last!.onmessage?.({ data: statusEvent, lastEventId: '1700000000000-3' });

      service.disconnect();
      service.connectToStream();
      http.expectOne('/api/v1/rooms/events/ticket').flush({ ticket: 't2', expires_in: 30 });

      expect(FakeEventSource.urls[1]).toBe('/api/v1/rooms/events?ticket=t2');
    });
  });

  describe('eventos de quartos no stream (T-35)', () => {
    const room = (id: number, number: string): Room => ({
      id,
      number,
      floor: 1,
      category_id: 1,
      status: 'AVAILABLE',
      capacity: null,
      category: null,
    });

    const seed = (rooms: Room[]) => {
      service.loadRooms();
      http.expectOne('/api/v1/rooms').flush(rooms);
    };

    it('room_created de um quarto novo recarrega a lista (aparece sem recarregar a página)', () => {
      seed([room(1, '101')]);

      service.handleEvent({
        event_type: 'room_created',
        room_id: 2,
        room_number: '102',
        category_id: 1,
        floor: 1,
        created_by: 'gerente@exemplo.test',
        timestamp: '2099-01-01T00:00:00Z',
      });
      http.expectOne('/api/v1/rooms').flush([room(1, '101'), room(2, '102')]);

      expect(service.rooms().map((r) => r.number)).toEqual(['101', '102']);
    });

    it('room_created de quarto já conhecido não recarrega', () => {
      seed([room(1, '101')]);
      service.handleEvent({
        event_type: 'room_created',
        room_id: 1,
        room_number: '101',
        category_id: 1,
        floor: 1,
        created_by: 'x',
        timestamp: '2099-01-01T00:00:00Z',
      });
      http.expectNone('/api/v1/rooms');
    });

    it('room_metadata_updated troca o número no mapa', () => {
      seed([room(1, '101')]);
      service.handleEvent({
        event_type: 'room_metadata_updated',
        room_id: 1,
        previous_number: '101',
        new_number: '101A',
        updated_by: 'x',
        timestamp: '2099-01-01T00:00:00Z',
      });
      expect(service.rooms()[0].number).toBe('101A');
    });

    it('room_status_changed continua atualizando o status', () => {
      seed([room(1, '101')]);
      service.handleEvent({
        event_type: 'room_status_changed',
        room_id: 1,
        room_number: '101',
        previous_status: 'AVAILABLE',
        new_status: 'CLEANING',
        changed_by: 'x',
        timestamp: '2099-01-01T00:00:00Z',
      });
      expect(service.rooms()[0].status).toBe('CLEANING');
    });
  });
});
