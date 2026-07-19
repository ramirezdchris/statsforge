import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { finalize } from 'rxjs';
import { AnalysisRequest } from '../../core/models/football.models';
import { AnalysisRequestsService } from '../../core/services/analysis-requests.service';
import { AuthService } from '../../core/services/auth.service';

type RequestFilter = 'ALL' | AnalysisRequest['status'];

@Component({
  selector: 'app-requests',
  imports: [ButtonModule, DatePipe, DialogModule, FormsModule, RouterLink],
  template: `
    <main class="layout-main min-w-0 p-4 sm:p-5 lg:p-7">
      <header class="topbar !flex flex-col items-stretch gap-3 sm:!flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="eyebrow">Solicitudes</p>
          <h1>{{ auth.hasRole('ADMIN', 'ANALYST') ? 'Bandeja' : 'Mis solicitudes' }}</h1>
        </div>
        <a class="text-button" routerLink="/basket">Nueva canasta</a>
      </header>

      @if (error()) {
        <p class="inline-error">{{ error() }}</p>
      }

      @if (notice()) {
        <p class="inline-success">{{ notice() }}</p>
      }

      <section class="request-toolbar work-panel min-w-0">
        <div class="request-tabs !grid grid-cols-2 gap-2 sm:!flex sm:flex-wrap">
          @for (filter of filters; track filter.key) {
            <button
              type="button"
              class="request-tab"
              [class.active]="activeFilter() === filter.key"
              (click)="setFilter(filter.key)"
            >
              <span>{{ filter.label }}</span>
              <strong>{{ countByFilter(filter.key) }}</strong>
            </button>
          }
        </div>
      </section>

      <section class="requests-layout !grid grid-cols-1 gap-4 xl:!grid-cols-[340px_minmax(0,1fr)] xl:items-start">
        <aside class="work-panel request-list-panel min-w-0">
          <div class="panel-heading !flex flex-col items-stretch gap-3 sm:!flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="eyebrow">Listado</p>
              <h2>{{ filteredRequests().length }} solicitud(es)</h2>
            </div>
            <button
              pButton
              type="button"
              icon="pi pi-refresh"
              severity="secondary"
              variant="outlined"
              (click)="load()"
            ></button>
          </div>

          <div class="request-list">
            @for (request of filteredRequests(); track request.id) {
              <button
                type="button"
                class="request-list-item"
                [class.active]="selectedRequest()?.id === request.id"
                (click)="selectRequest(request)"
              >
                <span class="status-badge" [class.inactive]="request.status === 'REJECTED'">
                  {{ statusLabel(request.status) }}
                </span>
                <strong>{{ request.basket.length }} partido(s)</strong>
                <small>{{ request.createdAt | date: 'dd/MM/yyyy HH:mm' }}</small>
                @if (request.requester) {
                  <small>{{ request.requester.name }} · {{ request.requester.role }}</small>
                }
              </button>
            } @empty {
              <p class="muted-copy">No hay solicitudes con este filtro.</p>
            }
          </div>
        </aside>

        <section class="work-panel request-detail-panel min-w-0">
          @if (selectedRequest(); as request) {
            <div class="panel-heading !flex flex-col items-stretch gap-3 lg:!flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <p class="eyebrow">{{ statusLabel(request.status) }}</p>
                <h2>{{ request.basket.length }} partido(s)</h2>
                <small>{{ request.createdAt | date: 'dd/MM/yyyy HH:mm' }}</small>
              </div>
              <span class="status-badge" [class.inactive]="request.status === 'REJECTED'">
                {{ request.estimatedCalls ?? 0 }} calls estimadas
              </span>
            </div>

            <div class="request-meta-grid !grid grid-cols-1 gap-3 sm:!grid-cols-2 xl:!grid-cols-4">
              @if (request.requester) {
                <div>
                  <span>Solicita</span>
                  <strong>{{ request.requester.name }}</strong>
                  <small>{{ request.requester.email }}</small>
                </div>
              }
              <div>
                <span>Historico</span>
                <strong>{{ request.historyDepth }} partidos</strong>
                <small>Plantilla global</small>
              </div>
              <div>
                <span>Entrega</span>
                <strong>{{ request.deliveryChannel }}</strong>
                <small>Telegram pendiente</small>
              </div>
              <div>
                <span>Excel</span>
                <strong>{{ request.includeExcel ? 'Solicitado' : 'No' }}</strong>
                <small>Generacion pendiente</small>
              </div>
            </div>

            @if (request.message) {
              <div class="request-note">
                <span>Mensaje</span>
                <p>{{ request.message }}</p>
              </div>
            }

            @if (request.rejectionReason) {
              <div class="request-note danger">
                <span>Motivo de rechazo</span>
                <p>{{ request.rejectionReason }}</p>
              </div>
            }

            <section class="detail-section">
              <div class="panel-heading compact-heading">
                <h2>Partidos y mercados</h2>
              </div>

              <div class="fixture-list">
                @for (item of request.basket; track item.fixtureId) {
                  <article class="fixture-row compact-row !grid grid-cols-1 gap-3 lg:!grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                    <div class="league-chip">
                      <img [src]="item.leagueLogoUrl || 'favicon.ico'" alt="" />
                      <span>{{ item.leagueName }}</span>
                    </div>
                    <div class="team-line">
                      <img [src]="item.homeTeamLogoUrl || 'favicon.ico'" alt="" />
                      <strong>{{ item.homeTeamName }}</strong>
                    </div>
                    <span class="versus">vs</span>
                    <div class="team-line">
                      <img [src]="item.awayTeamLogoUrl || 'favicon.ico'" alt="" />
                      <strong>{{ item.awayTeamName }}</strong>
                    </div>
                    <small>
                      {{
                        item.marketsOverride?.length
                          ? item.marketsOverride?.join(', ')
                          : 'Plantilla: ' + request.defaultMarkets.join(', ')
                      }}
                    </small>
                  </article>
                }
              </div>
            </section>

            <section class="detail-section">
              <div class="panel-heading compact-heading !flex flex-col items-stretch gap-3 md:!flex-row md:items-center md:justify-between">
                <h2>JSON</h2>
                <div class="toolbar-actions !flex flex-col items-stretch gap-2 sm:!flex-row sm:flex-wrap sm:items-center">
                  <button
                    pButton
                    type="button"
                    icon="pi pi-copy"
                    label="Copiar JSON"
                    severity="secondary"
                    variant="outlined"
                    [disabled]="!request.result"
                    (click)="copyJson(request)"
                  ></button>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-download"
                    label="Descargar"
                    severity="secondary"
                    variant="outlined"
                    [disabled]="!request.result"
                    (click)="downloadJson(request)"
                  ></button>
                </div>
              </div>

              @if (request.result) {
                <pre class="json-box">{{ stringify(request.result) }}</pre>
              } @else {
                <p class="muted-copy">El JSON se genera cuando la solicitud se aprueba.</p>
              }
            </section>

            @if (auth.hasRole('ADMIN', 'ANALYST') && request.status === 'PENDING') {
              <div class="dialog-actions request-actions !flex flex-col items-stretch gap-2 sm:!flex-row sm:justify-end">
                <button
                  pButton
                  type="button"
                  icon="pi pi-times"
                  label="Rechazar"
                  severity="danger"
                  variant="outlined"
                  [disabled]="busyId() === request.id"
                  (click)="openRejectDialog(request)"
                ></button>
                <button
                  pButton
                  type="button"
                  icon="pi pi-check"
                  label="Aprobar y generar JSON"
                  [disabled]="busyId() === request.id"
                  [loading]="busyId() === request.id"
                  (click)="approve(request.id)"
                ></button>
              </div>
            }
          } @else {
            <div class="empty-state">
              <i class="pi pi-inbox" aria-hidden="true"></i>
              <p>Selecciona una solicitud para ver el detalle.</p>
            </div>
          }
        </section>
      </section>

      <p-dialog
        header="Rechazar solicitud"
        [modal]="true"
        [visible]="rejectDialogOpen()"
        (visibleChange)="rejectDialogOpen.set($event)"
        [style]="{ width: 'min(92vw, 520px)' }"
      >
        <label>
          Motivo
          <textarea [(ngModel)]="rejectReason" rows="4"></textarea>
        </label>

        <div class="dialog-actions">
          <button
            pButton
            type="button"
            label="Cancelar"
            severity="secondary"
            variant="outlined"
            (click)="rejectDialogOpen.set(false)"
          ></button>
          <button
            pButton
            type="button"
            icon="pi pi-times"
            label="Rechazar"
            severity="danger"
            [disabled]="!pendingRejectId() || busyId() === pendingRejectId()"
            (click)="confirmReject()"
          ></button>
        </div>
      </p-dialog>
    </main>
  `,
})
export class RequestsComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly requestsService = inject(AnalysisRequestsService);

  readonly requests = signal<AnalysisRequest[]>([]);
  readonly selectedRequestId = signal<string | null>(null);
  readonly activeFilter = signal<RequestFilter>('ALL');
  readonly error = signal('');
  readonly notice = signal('');
  readonly busyId = signal<string | null>(null);
  readonly rejectDialogOpen = signal(false);
  readonly pendingRejectId = signal<string | null>(null);
  readonly selectedRequest = computed(
    () => this.requests().find((request) => request.id === this.selectedRequestId()) ?? null,
  );
  readonly filteredRequests = computed(() => {
    const filter = this.activeFilter();
    return filter === 'ALL'
      ? this.requests()
      : this.requests().filter((request) => request.status === filter);
  });

  rejectReason = '';

  readonly filters: Array<{ key: RequestFilter; label: string }> = [
    { key: 'ALL', label: 'Todas' },
    { key: 'PENDING', label: 'Pendientes' },
    { key: 'COMPLETED', label: 'Completadas' },
    { key: 'REJECTED', label: 'Rechazadas' },
    { key: 'FAILED', label: 'Fallidas' },
  ];

  ngOnInit() {
    this.load();
  }

  setFilter(filter: RequestFilter) {
    this.activeFilter.set(filter);
    const first = this.filteredRequests()[0];
    this.selectedRequestId.set(first?.id ?? null);
  }

  countByFilter(filter: RequestFilter) {
    return filter === 'ALL'
      ? this.requests().length
      : this.requests().filter((request) => request.status === filter).length;
  }

  selectRequest(request: AnalysisRequest) {
    this.selectedRequestId.set(request.id);
    this.notice.set('');
    this.error.set('');
  }

  approve(id: string) {
    this.busyId.set(id);
    this.error.set('');
    this.notice.set('');
    this.requestsService
      .approve(id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (request) => {
          this.notice.set('Solicitud aprobada y JSON generado.');
          this.load(request.id);
        },
        error: () => this.error.set('No se pudo aprobar la solicitud. Revisa cuota/cobertura.'),
      });
  }

  openRejectDialog(request: AnalysisRequest) {
    this.pendingRejectId.set(request.id);
    this.rejectReason = request.rejectionReason ?? '';
    this.rejectDialogOpen.set(true);
  }

  confirmReject() {
    const id = this.pendingRejectId();

    if (!id) {
      return;
    }

    this.busyId.set(id);
    this.error.set('');
    this.notice.set('');
    this.requestsService
      .reject(id, this.rejectReason || 'Sin motivo especificado')
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (request) => {
          this.rejectDialogOpen.set(false);
          this.pendingRejectId.set(null);
          this.notice.set('Solicitud rechazada.');
          this.load(request.id);
        },
        error: () => this.error.set('No se pudo rechazar la solicitud.'),
      });
  }

  async copyJson(request: AnalysisRequest) {
    if (!request.result) {
      return;
    }

    const text = this.stringify(request.result);

    try {
      await navigator.clipboard.writeText(text);
      this.notice.set('JSON copiado al portapapeles.');
      this.error.set('');
    } catch {
      this.error.set('No se pudo copiar el JSON desde el navegador.');
    }
  }

  downloadJson(request: AnalysisRequest) {
    if (!request.result) {
      return;
    }

    const blob = new Blob([this.stringify(request.result)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statsforge_${request.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  statusLabel(status: AnalysisRequest['status']) {
    const labels: Record<AnalysisRequest['status'], string> = {
      PENDING: 'Pendiente',
      APPROVED: 'Aprobada',
      COMPLETED: 'Completada',
      REJECTED: 'Rechazada',
      FAILED: 'Fallida',
    };

    return labels[status];
  }

  stringify(value: unknown) {
    return JSON.stringify(value, null, 2);
  }

  load(preferredId?: string) {
    this.requestsService.findAll().subscribe({
      next: (requests) => {
        this.requests.set(requests);
        const currentId = preferredId ?? this.selectedRequestId();
        const currentExists = currentId && requests.some((request) => request.id === currentId);
        this.selectedRequestId.set(
          currentExists ? currentId : (this.filteredRequests()[0]?.id ?? requests[0]?.id ?? null),
        );
      },
      error: () => this.error.set('No se pudieron cargar solicitudes.'),
    });
  }
}
