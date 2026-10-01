import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoomEditDialogComponent } from './room-edit-dialog.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RoomsService } from '../services/rooms.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { FormBuilder } from '@angular/forms';
import { Room } from '../models/room.model';

describe('RoomEditDialogComponent', () => {
  let component: RoomEditDialogComponent;
  let fixture: ComponentFixture<RoomEditDialogComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<RoomEditDialogComponent>>;
  let mockRoomsService: jasmine.SpyObj<RoomsService>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    mockRoomsService = jasmine.createSpyObj('RoomsService', ['createRoom', 'updateRoomMetadata']);
    mockSnackBar = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [RoomEditDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { room: undefined } }, // Modo criação
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: RoomsService, useValue: mockRoomsService },
        { provide: MatSnackBar, useValue: mockSnackBar },
        FormBuilder,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoomEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in creation mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode).toBeFalse();
  });

  it('should call createRoom when saving new room', () => {
    component.form.setValue({
      number: '105',
      floor: 1,
      category_id: 1,
      capacity: 2,
    });
    mockRoomsService.createRoom.and.returnValue(of({} as unknown as Room));

    component.save();

    expect(mockRoomsService.createRoom).toHaveBeenCalledWith({
      number: '105',
      floor: 1,
      category_id: 1,
      capacity: 2,
    });
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  describe('limites do número do quarto (os mesmos da API, T-88)', () => {
    const numberErrors = (value: string) => {
      const control = component.form.get('number')!;
      control.setValue(value);
      return control.errors;
    };

    it('recusa número só com espaços', () => {
      expect(numberErrors('   ')).toEqual(
        jasmine.objectContaining({ pattern: jasmine.anything() }),
      );
    });

    it('recusa mais de 10 caracteres', () => {
      expect(numberErrors('12345678901')).toEqual(
        jasmine.objectContaining({ maxlength: jasmine.anything() }),
      );
    });

    it('aceita exatamente 10 caracteres', () => {
      expect(numberErrors('1234567890')).toBeNull();
    });
  });
});
