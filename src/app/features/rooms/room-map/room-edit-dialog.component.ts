import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse, HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { RoomsService } from '../services/rooms.service';
import { Room, RoomCategoryOption } from '../models/room.model';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface RoomEditDialogData {
  room?: Room; // Se definido, modo de edição. Senão, modo de criação.
}

@Component({
  selector: 'app-room-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEditMode ? 'Editar Quarto' : 'Novo Quarto' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" (ngSubmit)="save()" class="edit-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Número do Quarto</mat-label>
          <input matInput formControlName="number" placeholder="Ex: 101" maxlength="10" />
          @if (
            form.get('number')?.hasError('required') || form.get('number')?.hasError('pattern')
          ) {
            <mat-error>O número é obrigatório.</mat-error>
          }
          @if (form.get('number')?.hasError('maxlength')) {
            <mat-error>O número tem no máximo 10 caracteres.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Andar (Setor)</mat-label>
          <input matInput type="number" formControlName="floor" placeholder="Ex: 1" />
          @if (form.get('floor')?.hasError('required')) {
            <mat-error>O andar é obrigatório.</mat-error>
          }
          @if (form.get('floor')?.hasError('min')) {
            <mat-error>O andar não pode ser negativo.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Categoria</mat-label>
          <mat-select formControlName="category_id">
            @for (cat of availableCategories; track cat.id) {
              <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
            }
          </mat-select>
          @if (form.get('category_id')?.hasError('required')) {
            <mat-error>A categoria é obrigatória.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Capacidade (Pessoas)</mat-label>
          <input matInput type="number" formControlName="capacity" placeholder="Ex: 2" />
          @if (form.get('capacity')?.hasError('required')) {
            <mat-error>A capacidade é obrigatória.</mat-error>
          }
          @if (form.get('capacity')?.hasError('min')) {
            <mat-error>A capacidade mínima é 1.</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="isSaving()">Cancelar</button>
      <button
        mat-flat-button
        color="primary"
        (click)="save()"
        [disabled]="form.invalid || isSaving()"
      >
        @if (isSaving()) {
          <mat-spinner diameter="20" class="spinner"></mat-spinner>
        } @else {
          Salvar
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .edit-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 8px;
        min-width: 300px;
      }
      .full-width {
        width: 100%;
      }
      .spinner {
        margin-right: 8px;
        display: inline-block;
        vertical-align: middle;
      }
    `,
  ],
})
export class RoomEditDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<RoomEditDialogComponent>);
  private data = inject<RoomEditDialogData>(MAT_DIALOG_DATA);
  private roomsService = inject(RoomsService);
  private snackBar = inject(MatSnackBar);
  private http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  isSaving = signal(false);
  isEditMode = !!this.data?.room;

  availableCategories: RoomCategoryOption[] = [];

  form: FormGroup = this.fb.group({
    // Mesmos limites da API (T-88): hospitality.rooms.number é String(10) e não aceita só espaços
    number: [
      this.data?.room?.number || '',
      [Validators.required, Validators.maxLength(10), Validators.pattern(/\S/)],
    ],
    floor: [this.data?.room?.floor ?? null, [Validators.required, Validators.min(0)]],
    category_id: [this.data?.room?.category?.id || null, Validators.required],
    capacity: [this.data?.room?.capacity ?? 1, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.http.get<RoomCategoryOption[]>(`${this.api}/rooms/categories`).subscribe({
      next: (cats) => {
        this.availableCategories = cats;
      },
      error: () => {
        this.snackBar.open('Falha ao carregar categorias', 'Fechar', { duration: 3000 });
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;

    this.isSaving.set(true);
    const payload = this.form.value;

    if (this.isEditMode) {
      this.roomsService.updateRoomMetadata(this.data.room!.id, payload).subscribe({
        next: () => this.onSuccess('Quarto atualizado com sucesso!'),
        error: (err) => this.onError(err),
      });
    } else {
      this.roomsService.createRoom(payload).subscribe({
        next: () => this.onSuccess('Quarto criado com sucesso!'),
        error: (err) => this.onError(err),
      });
    }
  }

  private onSuccess(msg: string): void {
    this.isSaving.set(false);
    this.snackBar.open(msg, 'Fechar', {
      duration: 3000,
      panelClass: ['success-snackbar'],
    });
    this.dialogRef.close(true);
  }

  private onError(err: unknown): void {
    this.isSaving.set(false);
    let msg = 'Falha ao salvar os dados do quarto.';
    if (err instanceof HttpErrorResponse) {
      if (err.status === 403) msg = 'Sem permissão para esta ação.';
      else if (err.status === 409) msg = 'Este número de quarto já existe.';
    }

    this.snackBar.open(msg, 'Fechar', {
      duration: 5000,
      panelClass: ['feedback-error'],
    });
  }
}
