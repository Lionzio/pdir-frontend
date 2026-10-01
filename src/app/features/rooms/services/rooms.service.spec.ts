import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthSignalService } from '../../../core/services/auth-signal.service';
import { RoomsService } from './rooms.service';

/** EventSource falso: registra a URL e expõe os handlers para o teste. */
class FakeEventSource {
  static urls: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = jasmine.createSpy('close');

  constructor(public url: string) {
    FakeEventSource.urls.push(url);
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
});
