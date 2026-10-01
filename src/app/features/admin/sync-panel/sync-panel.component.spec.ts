import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { IntegrationsService, SheetsSyncStatus } from '../../../core/services/integrations.service';
import { SyncPanelComponent } from './sync-panel.component';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe('SyncPanelComponent (T-37)', () => {
  let fixture: ComponentFixture<SyncPanelComponent>;
  let service: jasmine.SpyObj<IntegrationsService>;

  const render = (status: SheetsSyncStatus) => {
    service.getSheetsStatus.and.returnValue(of(status));
    fixture = TestBed.createComponent(SyncPanelComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj('IntegrationsService', ['getSheetsStatus', 'forceSheetsSync']);
    service.forceSheetsSync.and.returnValue(
      of({ status: 'accepted', message: 'Sincronização enviada.', initiated_by: 'x' }),
    );
    await TestBed.configureTestingModule({
      imports: [SyncPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: IntegrationsService, useValue: service },
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open']) },
      ],
    }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  it('alerta quando a última sincronização passou de 15 minutos', () => {
    const el = render({
      last_sync: { finished_at: minutesAgo(20), stats: {} },
      retry_queue_size: 0,
      recent_failures: [],
    });
    expect(el.querySelector('.stale-alert')).not.toBeNull();
  });

  it('sem alerta com sincronização recente; mostra fila e falhas', () => {
    const el = render({
      last_sync: { finished_at: minutesAgo(2), stats: {} },
      retry_queue_size: 3,
      recent_failures: [
        { timestamp: minutesAgo(3), direction: 'OUTBOUND', description: 'HTTP 429 no quarto 101' },
      ],
    });
    expect(el.querySelector('.stale-alert')).toBeNull();
    expect(el.querySelector('.queue')?.textContent).toContain('3');
    expect(el.querySelector('.failures')?.textContent).toContain('HTTP 429 no quarto 101');
  });

  it('nunca sincronizou também alerta', () => {
    const el = render({ last_sync: null, retry_queue_size: 0, recent_failures: [] });
    expect(el.querySelector('.stale-alert')).not.toBeNull();
    expect(el.querySelector('.last-sync')?.textContent).toContain('nunca');
  });

  it('o botão chama a API real e recarrega o status, sem spinner simulado', () => {
    render({ last_sync: null, retry_queue_size: 0, recent_failures: [] });
    service.getSheetsStatus.calls.reset();

    fixture.componentInstance.triggerEmergencySync();

    expect(service.forceSheetsSync).toHaveBeenCalled();
    expect(service.getSheetsStatus).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.isSyncing()).toBeFalse();
  });
});
