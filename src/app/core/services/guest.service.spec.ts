import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GuestService, Guest } from './guest.service';

describe('GuestService', () => {
  let service: GuestService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GuestService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GuestService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null immediately if CPF does not have 11 digits', (done) => {
    service.checkGuestByCpf('123').subscribe((guest) => {
      expect(guest).toBeNull();
      done();
    });
  });

  it('should fetch guest by CPF successfully', (done) => {
    const mockGuest: Guest = {
      id: 1,
      full_name: 'Carlos Eduardo',
      cpf: '12345678901',
      email: 'carlos@teste.com',
    };

    service.checkGuestByCpf('123.456.789-01').subscribe((guest) => {
      expect(guest).toEqual(mockGuest);
      done();
    });

    const req = httpTestingController.expectOne('/api/v1/guests/cpf/12345678901');
    expect(req.request.method).toBe('GET');
    req.flush(mockGuest);
  });

  it('should return null when guest is not found (404)', (done) => {
    service.checkGuestByCpf('00000000000').subscribe((guest) => {
      expect(guest).toBeNull();
      done();
    });

    const req = httpTestingController.expectOne('/api/v1/guests/cpf/00000000000');
    expect(req.request.method).toBe('GET');
    req.flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });
  });
});
