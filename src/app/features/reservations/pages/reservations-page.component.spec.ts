import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ReservationsPageComponent } from './reservations-page.component';
import { ReservationsService } from '../services/reservations.service';
import { RoomsService } from '../../rooms/services/rooms.service';
import { Room } from '../../rooms/models/room.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('ReservationsPageComponent', () => {
  let component: ReservationsPageComponent;
  let fixture: ComponentFixture<ReservationsPageComponent>;
  let mockReservationsService: jasmine.SpyObj<ReservationsService>;
  let mockRoomsService: jasmine.SpyObj<RoomsService>;

  const mockRooms: Room[] = [
    {
      id: 1,
      number: '101',
      floor: 1,
      status: 'AVAILABLE',
      capacity: 2,
      category: { id: 1, name: 'Standard' },
    },
    {
      id: 2,
      number: 'Apto 15',
      floor: 2,
      status: 'OCCUPIED',
      capacity: 3,
      category: { id: 2, name: 'Luxo' },
    },
    {
      id: 3,
      number: null as unknown as string,
      floor: 3,
      status: 'CLEANING',
      capacity: 1,
    },
  ];

  beforeEach(async () => {
    mockReservationsService = jasmine.createSpyObj('ReservationsService', ['listReservations']);
    mockReservationsService.listReservations.and.returnValue(of([]));

    mockRoomsService = jasmine.createSpyObj('RoomsService', ['loadRooms']);
    Object.defineProperty(mockRoomsService, 'rooms', {
      get: () => signal(mockRooms),
    });

    await TestBed.configureTestingModule({
      imports: [ReservationsPageComponent, NoopAnimationsModule],
      providers: [
        { provide: ReservationsService, useValue: mockReservationsService },
        { provide: RoomsService, useValue: mockRoomsService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReservationsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should map timelineRooms with r.number and fallback to String(r.id)', () => {
    const timeline = component.timelineRooms();
    expect(timeline.length).toBe(3);

    // Quarto com número normal
    expect(timeline[0].id).toBe(1);
    expect(timeline[0].number).toBe('101');
    expect(timeline[0].categoryName).toBe('Standard');

    // Quarto com número textual especial
    expect(timeline[1].id).toBe(2);
    expect(timeline[1].number).toBe('Apto 15');
    expect(timeline[1].categoryName).toBe('Luxo');

    // Quarto com número ausente -> fallback para ID
    expect(timeline[2].id).toBe(3);
    expect(timeline[2].number).toBe('3');
    expect(timeline[2].categoryName).toBe('Padrão');
  });

  it('usa o nome real do hóspede na timeline, com fallback quando ausente (T-33)', () => {
    mockReservationsService.listReservations.and.returnValue(
      of([
        {
          id: 1,
          room_id: 1,
          guest_id: 9,
          guest_name: 'Maria Fictícia',
          check_in: '2099-01-01',
          check_out: '2099-01-03',
          status: 'CONFIRMED',
          total_price: 200,
        },
        {
          id: 2,
          room_id: 1,
          guest_id: null,
          guest_name: null,
          check_in: '2099-01-05',
          check_out: '2099-01-06',
          status: 'CONFIRMED',
          total_price: 100,
        },
      ]),
    );
    component.loadReservations();

    const names = component.timelineReservations().map((r) => r.guestName);
    expect(names).toEqual(['Maria Fictícia', 'Hóspede']);
    expect(names.join(' ')).not.toContain('#');
  });
});
