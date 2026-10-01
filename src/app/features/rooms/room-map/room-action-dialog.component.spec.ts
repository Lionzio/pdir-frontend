import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RoomActionDialogComponent } from './room-action-dialog.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RoomsService } from '../services/rooms.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthSignalService } from '../../../core/services/auth-signal.service';
import { signal } from '@angular/core';
import { Room } from '../models/room.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

describe('RoomActionDialogComponent', () => {
  let component: RoomActionDialogComponent;
  let fixture: ComponentFixture<RoomActionDialogComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<RoomActionDialogComponent>>;
  let mockRoomsService: jasmine.SpyObj<RoomsService>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;
  let mockAuthService: jasmine.SpyObj<AuthSignalService>;

  const mockRoom: Room = { id: 1, number: '101', floor: 1, status: 'AVAILABLE', capacity: 2 };
  const roomsSignal = signal<Room[]>([mockRoom]);

  beforeEach(async () => {
    roomsSignal.set([{ ...mockRoom, status: 'AVAILABLE' }]);
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    mockRoomsService = jasmine.createSpyObj('RoomsService', ['updateRoomStatus']);
    mockSnackBar = jasmine.createSpyObj('MatSnackBar', ['open']);
    mockAuthService = jasmine.createSpyObj('AuthSignalService', [
      'hasPermission',
      'role',
      'hasRole',
    ]);

    // Setup signals
    Object.defineProperty(mockRoomsService, 'rooms', { get: () => roomsSignal });
    mockAuthService.hasPermission.and.returnValue(true); // default to allow everything for basic tests
    mockAuthService.hasRole.and.returnValue(true);
    mockAuthService.role.and.returnValue('DONO'); // default role

    await TestBed.configureTestingModule({
      imports: [RoomActionDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { roomId: 1 } },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: RoomsService, useValue: mockRoomsService },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: AuthSignalService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoomActionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load room from service', () => {
    expect(component).toBeTruthy();
    expect(component.room()?.id).toBe(1);
  });

  it('should call updateRoomStatus and close on success', () => {
    mockRoomsService.updateRoomStatus.and.returnValue(of(mockRoom));

    component.updateStatus('OCCUPIED');

    expect(component.isUpdating()).toBeFalse();
    expect(mockRoomsService.updateRoomStatus).toHaveBeenCalledWith(1, 'OCCUPIED');
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Status do quarto atualizado com sucesso!',
      'Fechar',
      jasmine.any(Object),
    );
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should handle error during update', () => {
    mockRoomsService.updateRoomStatus.and.returnValue(throwError(() => ({ status: 500 })));

    component.updateStatus('MAINTENANCE');

    expect(component.isUpdating()).toBeFalse();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Falha ao atualizar o status do quarto.',
      'Fechar',
      jasmine.any(Object),
    );
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should handle 403 error gracefully', () => {
    mockRoomsService.updateRoomStatus.and.returnValue(throwError(() => ({ status: 403 })));

    component.updateStatus('MAINTENANCE');

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Sem permissão para esta ação.',
      'Fechar',
      jasmine.any(Object),
    );
  });

  it('should show snackbar if room status changes externally (SSE simulation)', fakeAsync(() => {
    // Component already initialized with AVAILABLE.
    // Simulate SSE update:
    roomsSignal.set([{ ...mockRoom, status: 'OCCUPIED' }]);

    fixture.detectChanges();
    tick(); // flush effects

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Atenção: O status deste quarto foi alterado para Ocupado externamente.',
      'Ciente',
      jasmine.any(Object),
    );
  }));

  describe('canCamareiraMakeAvailable', () => {
    it('should return true for DONO/GERENTE', () => {
      mockAuthService.hasPermission.and.returnValue(false);
      mockAuthService.role.and.returnValue('GERENTE');
      expect(component.canCamareiraMakeAvailable()).toBeTrue();
    });

    it('should return true for RECEPCIONISTA', () => {
      mockAuthService.hasPermission.and.returnValue(false);
      mockAuthService.role.and.returnValue('RECEPCIONISTA');
      expect(component.canCamareiraMakeAvailable()).toBeTrue();
    });

    it('should return true for CAMAREIRA when status is CLEANING or OCCUPIED', () => {
      mockAuthService.hasPermission.and.returnValue(false);
      mockAuthService.role.and.returnValue('CAMAREIRA');

      roomsSignal.set([{ ...mockRoom, status: 'CLEANING' }]);
      fixture.detectChanges();
      expect(component.canCamareiraMakeAvailable()).toBeTrue();

      roomsSignal.set([{ ...mockRoom, status: 'OCCUPIED' }]);
      fixture.detectChanges();
      expect(component.canCamareiraMakeAvailable()).toBeTrue();
    });

    it('should return false for CAMAREIRA when status is AVAILABLE', () => {
      mockAuthService.hasPermission.and.returnValue(false);
      mockAuthService.role.and.returnValue('CAMAREIRA');

      roomsSignal.set([{ ...mockRoom, status: 'AVAILABLE' }]);
      fixture.detectChanges();
      expect(component.canCamareiraMakeAvailable()).toBeFalse();
    });
  });
  // T-34: cada papel só vê as ações que o backend aceita
  describe('ações por papel', () => {
    const render = (role: string, status: Room['status']): string[] => {
      mockAuthService.role.and.returnValue(role);
      mockAuthService.hasPermission.and.returnValue(false);
      // Mesma semântica do AuthSignalService.hasRole real, inclusive o curinga 'all'
      mockAuthService.hasRole.and.callFake(
        (roles: string[]) => roles.includes('all') || roles.includes(role),
      );
      roomsSignal.set([{ ...mockRoom, status }]);
      const view = TestBed.createComponent(RoomActionDialogComponent);
      view.detectChanges();
      const buttons = view.nativeElement.querySelectorAll('.action-buttons button');
      return Array.from(buttons as NodeListOf<HTMLElement>).map(
        (b) => Array.from(b.classList).find((c) => c.startsWith('btn-')) ?? '',
      );
    };

    it('camareira só vê a opção de liberar o quarto', () => {
      expect(render('CAMAREIRA', 'CLEANING')).toEqual(['btn-available']);
    });

    it('camareira não vê ação nenhuma num quarto em manutenção', () => {
      expect(render('CAMAREIRA', 'MAINTENANCE')).toEqual([]);
    });

    it('recepcionista não vê limpeza, manutenção nem interdição', () => {
      expect(render('RECEPCIONISTA', 'CLEANING')).toEqual(['btn-available', 'btn-occupied']);
    });

    it('gerente vê as ações de gestão', () => {
      expect(render('GERENTE', 'AVAILABLE')).toEqual([
        'btn-occupied',
        'btn-cleaning',
        'btn-maintenance',
        'btn-out-of-service',
      ]);
    });
  });
});
