import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { IamService, UserSummary } from '../../../core/services/iam.service';
import { ApprovalsPageComponent } from './approvals-page.component';

const PENDING: UserSummary[] = [
  {
    id: 1,
    email: 'ana@exemplo.test',
    full_name: 'Ana Fictícia',
    role: 'RECEPCIONISTA',
    status: 'PENDING_APPROVAL',
  },
  {
    id: 2,
    email: 'bia@exemplo.test',
    full_name: 'Bia Fictícia',
    role: 'CAMAREIRA',
    status: 'PENDING_APPROVAL',
  },
];

describe('ApprovalsPageComponent (T-39)', () => {
  let fixture: ComponentFixture<ApprovalsPageComponent>;
  let iam: jasmine.SpyObj<IamService>;
  let snackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    iam = jasmine.createSpyObj('IamService', ['listByStatus', 'updateStatus']);
    iam.listByStatus.and.returnValue(of(PENDING));
    iam.updateStatus.and.returnValue(of({}));
    snackBar = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [ApprovalsPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: IamService, useValue: iam },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApprovalsPageComponent);
    fixture.detectChanges();
  });

  const items = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.pending-item'));

  const click = (item: HTMLElement, selector: string) =>
    (item.querySelector(selector) as HTMLButtonElement).click();

  it('lista os cadastros pendentes', () => {
    expect(iam.listByStatus).toHaveBeenCalledWith('PENDING_APPROVAL');
    expect(items().length).toBe(2);
    expect(items()[0].textContent).toContain('Ana Fictícia');
  });

  it('aprovar envia APPROVED e tira o item da lista', () => {
    click(items()[0], '.btn-approve');
    fixture.detectChanges();

    expect(iam.updateStatus).toHaveBeenCalledWith(1, 'APPROVED');
    expect(items().length).toBe(1);
    expect(items()[0].textContent).toContain('Bia Fictícia');
  });

  it('rejeitar envia REJECTED', () => {
    click(items()[1], '.btn-reject');
    expect(iam.updateStatus).toHaveBeenCalledWith(2, 'REJECTED');
  });

  it('erro do backend mantém o item e mostra o detalhe', () => {
    iam.updateStatus.and.returnValue(
      throwError(() => ({ status: 409, error: { detail: 'Transição inválida.' } })),
    );
    click(items()[0], '.btn-approve');
    fixture.detectChanges();

    expect(items().length).toBe(2);
    expect(snackBar.open).toHaveBeenCalledWith(
      'Transição inválida.',
      'Fechar',
      jasmine.any(Object),
    );
  });
});
