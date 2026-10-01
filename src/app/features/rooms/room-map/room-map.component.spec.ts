import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RoomMapComponent } from './room-map.component';
import { RoomsService } from '../services/rooms.service';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { Room } from '../models/room.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AuthSignalService } from '../../../core/services/auth-signal.service';

describe('RoomMapComponent', () => {
  let component: RoomMapComponent;
  let fixture: ComponentFixture<RoomMapComponent>;
  let mockRoomsService: jasmine.SpyObj<RoomsService>;
  let mockDialog: jasmine.SpyObj<MatDialog>;

  const mockRooms: Room[] = [
    {
      id: 1,
      number: '101',
      floor: 1,
      category_id: 1,
      status: 'AVAILABLE',
      capacity: 2,
      category: {
        id: 1,
        name: 'Standard',
        capacity: 2,
        has_ac: true,
        has_breakfast: false,
        base_rate: 150,
      },
    },
    { id: 2, number: '102', floor: 1, category_id: 1, status: 'OCCUPIED', capacity: 3 },
    { id: 3, number: '201', floor: 2, category_id: 1, status: 'CLEANING', capacity: 1 },
    { id: 4, number: '202', floor: 2, category_id: 1, status: 'MAINTENANCE', capacity: 4 },
  ];

  beforeEach(async () => {
    mockRoomsService = jasmine.createSpyObj('RoomsService', [
      'loadRooms',
      'connectToStream',
      'disconnect',
    ]);

    // Setup signals for mock service
    Object.defineProperty(mockRoomsService, 'rooms', { get: () => signal(mockRooms) });
    Object.defineProperty(mockRoomsService, 'loading', { get: () => signal(false) });
    Object.defineProperty(mockRoomsService, 'connected', { get: () => signal(true) });
    Object.defineProperty(mockRoomsService, 'error', { get: () => signal(null) });

    mockDialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [RoomMapComponent, NoopAnimationsModule],
      providers: [{ provide: RoomsService, useValue: mockRoomsService }, provideRouter([])],
    })
      .overrideComponent(RoomMapComponent, {
        set: {
          providers: [{ provide: MatDialog, useValue: mockDialog }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RoomMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should group rooms by floor correctly when ALL filter is active', () => {
    const terreoRooms = component.terreo();
    const primeiroAndarRooms = component.primeiroAndar();
    const anexosRooms = component.anexos();

    expect(terreoRooms.length).toBe(2);
    expect(primeiroAndarRooms.length).toBe(2);
    expect(anexosRooms.length).toBe(0);
  });

  it('should filter rooms by status', () => {
    component.statusFilter.set('OCCUPIED');
    fixture.detectChanges();

    const terreoRooms = component.terreo();
    const primeiroAndarRooms = component.primeiroAndar();

    expect(terreoRooms.length).toBe(1); // Only floor 1 has an occupied room
    expect(terreoRooms[0].number).toBe('102');
    expect(primeiroAndarRooms.length).toBe(0);
  });

  it('should open status action dialog with correct data on room click', () => {
    component.openStatusActionDialog(mockRooms[0]);
    expect(mockDialog.open).toHaveBeenCalled();
    const args = mockDialog.open.calls.mostRecent().args;
    expect(args[1]?.data).toEqual({ roomId: mockRooms[0].id });
  });

  it('should open edit metadata dialog with correct data', () => {
    component.openEditMetadataDialog(mockRooms[0]);
    expect(mockDialog.open).toHaveBeenCalled();
    const args = mockDialog.open.calls.mostRecent().args;
    expect(args[1]?.data).toEqual({ room: mockRooms[0] });
  });

  it('should connect to SSE and load rooms on init', () => {
    expect(mockRoomsService.loadRooms).toHaveBeenCalled();
    expect(mockRoomsService.connectToStream).toHaveBeenCalled();
  });

  it('should disconnect on destroy', () => {
    component.ngOnDestroy();
    expect(mockRoomsService.disconnect).toHaveBeenCalled();
  });

  describe('atalhos do cabeçalho por papel (T-52)', () => {
    const headerButtons = (role: string): string => {
      TestBed.inject(AuthSignalService).updateSession('token', {
        sub: `${role.toLowerCase()}@exemplo.test`,
        user_id: 9,
        role,
        permissions: [],
      });
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll(
        '.header-actions button',
      ) as NodeListOf<HTMLElement>;
      return Array.from(buttons, (b) => b.textContent ?? '').join(' | ');
    };

    afterEach(() => TestBed.inject(AuthSignalService).clearSession());

    it('a CAMAREIRA não recebe atalhos para as reservas, que ela não pode abrir', () => {
      const buttons = headerButtons('CAMAREIRA');
      expect(buttons).not.toContain('Grade de Reservas');
      expect(buttons).not.toContain('Nova Reserva');
    });

    it('a RECEPCIONISTA vê a grade e a nova reserva', () => {
      const buttons = headerButtons('RECEPCIONISTA');
      expect(buttons).toContain('Grade de Reservas');
      expect(buttons).toContain('Nova Reserva');
    });
  });
});
