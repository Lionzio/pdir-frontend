import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReservationsService, Reservation } from './reservations.service';
import { Room } from '../../rooms/models/room.model';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReservationsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReservationsService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create reservation via POST', (done) => {
    const mockRes: Reservation = {
      id: 10,
      room_id: 1,
      guest_id: 2,
      check_in: '2026-09-01',
      check_out: '2026-09-05',
      status: 'CONFIRMED',
      total_price: 800,
    };

    service
      .createReservation({
        room_id: 1,
        guest_cpf: '12345678901',
        guest_full_name: 'Teste',
        check_in: new Date(2026, 8, 1),
        check_out: new Date(2026, 8, 5),
        status: 'CONFIRMED',
      })
      .subscribe((res) => {
        expect(res).toEqual(mockRes);
        done();
      });

    const req = httpTestingController.expectOne('/api/v1/reservations');
    expect(req.request.method).toBe('POST');
    req.flush(mockRes);
  });

  it('should list reservations with date query parameters', (done) => {
    const mockList: Reservation[] = [
      {
        id: 1,
        room_id: 1,
        guest_id: 2,
        check_in: '2026-09-01',
        check_out: '2026-09-05',
        status: 'CONFIRMED',
        total_price: 800,
      },
    ];

    const start = new Date(2026, 8, 1);
    const end = new Date(2026, 8, 10);

    service.listReservations(start, end).subscribe((list) => {
      expect(list).toEqual(mockList);
      done();
    });

    const req = httpTestingController.expectOne((r) => {
      return (
        r.url === '/api/v1/reservations' && r.params.has('start_date') && r.params.has('end_date')
      );
    });
    expect(req.request.method).toBe('GET');
    req.flush(mockList);
  });

  it('should list available rooms with check_in and check_out query parameters', (done) => {
    const mockRooms: Room[] = [
      {
        id: 1,
        number: '101',
        floor: 1,
        status: 'AVAILABLE',
        capacity: 2,
      },
    ];

    const checkIn = new Date(2026, 9, 10);
    const checkOut = new Date(2026, 9, 15);

    service.listAvailableRooms(checkIn, checkOut).subscribe((rooms) => {
      expect(rooms).toEqual(mockRooms);
      done();
    });

    const req = httpTestingController.expectOne((r) => {
      return (
        r.url === '/api/v1/rooms/available' &&
        r.params.get('check_in') === '2026-10-10' &&
        r.params.get('check_out') === '2026-10-15'
      );
    });
    expect(req.request.method).toBe('GET');
    req.flush(mockRooms);
  });
});
