import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import {
  FootballFixture,
  FootballLeague,
  Market,
} from '../../core/models/football.models';
import { AnalysisRequestsService } from '../../core/services/analysis-requests.service';
import { BasketService } from '../../core/services/basket.service';
import { FootballService } from '../../core/services/football.service';
import { MarketsService } from '../../core/services/markets.service';

@Component({
  selector: 'app-basket',
  imports: [
    ButtonModule,
    CheckboxModule,
    DatePipe,
    DialogModule,
    FormsModule,
    RouterLink,
    TableModule,
  ],
  template: `
    <main class="layout-main min-w-0 p-4 sm:p-5 lg:p-7">
      <header class="topbar !flex flex-col items-stretch gap-3 sm:!flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="eyebrow">Generador</p>
          <h1>Canasta de analisis</h1>
        </div>
        <a class="text-button" routerLink="/requests">Solicitudes</a>
      </header>

      <section class="work-panel basket-workbench min-w-0">
        <div class="panel-heading !flex flex-col items-stretch gap-4 lg:!flex-row lg:items-center lg:justify-between">
          <div class="min-w-0">
            <p class="eyebrow">Seleccion</p>
            <h2>Partidos</h2>
          </div>
          <div class="toolbar-actions !flex flex-col items-stretch gap-2 sm:!flex-row sm:flex-wrap sm:items-center">
            <button
              pButton
              type="button"
              icon="pi pi-search"
              label="Elegir ligas"
              (click)="openLeagueDialog()"
            ></button>
            <button
              pButton
              type="button"
              icon="pi pi-calendar"
              label="Cargar partidos"
              severity="secondary"
              [disabled]="!selectedLeagues().length"
              (click)="openFixturesDialog()"
            ></button>
            <button
              pButton
              type="button"
              icon="pi pi-cog"
              label="Ajustes"
              severity="secondary"
              variant="outlined"
              (click)="settingsDialogOpen.set(true)"
            ></button>
          </div>
        </div>

        @if (selectedLeagues().length) {
          <div class="selected-leagues !grid grid-cols-1 gap-2 sm:!grid-cols-2 xl:!grid-cols-3">
            @for (league of selectedLeagues(); track league.league.id) {
              <div class="selected-league compact-league min-w-0">
                <img [src]="league.league.logo || league.country.flag || 'favicon.ico'" alt="" />
                <span class="min-w-0">
                  <strong>{{ league.league.name }}</strong>
                  <small>{{ league.country.name }} · temporada {{ season }}</small>
                </span>
                <button
                  pButton
                  type="button"
                  icon="pi pi-times"
                  severity="secondary"
                  variant="text"
                  (click)="removeLeague(league.league.id)"
                ></button>
              </div>
            }
          </div>
        }

        <div class="w-full overflow-x-auto">
          <p-table [value]="basket.items()" styleClass="basket-table min-w-[760px]">
            <ng-template pTemplate="header">
              <tr>
                <th>Liga</th>
                <th>Partido</th>
                <th>Fecha</th>
                <th>Mercados</th>
                <th>Acciones</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-item>
              <tr>
                <td>
                  <div class="league-chip">
                    <img [src]="item.leagueLogoUrl || 'favicon.ico'" alt="" />
                    <span>{{ item.leagueName }}</span>
                  </div>
                </td>
                <td>
                  <div class="match-cell">
                    <span class="team-line">
                      <img [src]="item.homeTeamLogoUrl || 'favicon.ico'" alt="" />
                      <strong>{{ item.homeTeamName }}</strong>
                    </span>
                    <span class="versus">vs</span>
                    <span class="team-line">
                      <img [src]="item.awayTeamLogoUrl || 'favicon.ico'" alt="" />
                      <strong>{{ item.awayTeamName }}</strong>
                    </span>
                  </div>
                </td>
                <td>{{ item.date | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-sliders-h"
                    [label]="item.marketsOverride?.length ? 'Personalizado' : 'Plantilla'"
                    severity="secondary"
                    variant="outlined"
                    (click)="openItemDialog(item.fixtureId)"
                  ></button>
                </td>
                <td>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-trash"
                    severity="danger"
                    variant="outlined"
                    (click)="basket.remove(item.fixtureId)"
                  ></button>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="5">Selecciona una liga y agrega partidos a la canasta.</td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      </section>

      <section class="content-grid !grid grid-cols-1 gap-4 xl:!grid-cols-[minmax(0,1fr)_320px]">
        <aside class="work-panel compact xl:col-start-2">
          <p class="eyebrow">Estimacion</p>
          <h2>{{ estimatedCalls() }} llamadas</h2>
          <p class="muted-copy">
            Plantilla: {{ defaultMarkets().length }} mercados · historico {{ historyDepth }}.
          </p>
          <button
            pButton
            type="button"
            icon="pi pi-send"
            label="Enviar a aprobacion"
            [disabled]="submitting() || !canSubmit()"
            [loading]="submitting()"
            (click)="submit()"
          ></button>
          <button
            pButton
            type="button"
            icon="pi pi-cog"
            label="Configurar plantilla"
            severity="secondary"
            variant="outlined"
            (click)="settingsDialogOpen.set(true)"
          ></button>
          @if (error()) {
            <p class="inline-error">{{ error() }}</p>
          }
        </aside>
      </section>

      <p-dialog
        header="Seleccionar ligas"
        [modal]="true"
        [visible]="leagueDialogOpen()"
        (visibleChange)="leagueDialogOpen.set($event)"
        [style]="{ width: 'min(94vw, 760px)' }"
      >
        <div class="dialog-search !grid grid-cols-1 gap-3 md:!grid-cols-[minmax(0,1fr)_140px_auto]">
          <label>
            Liga
            <input [(ngModel)]="leagueSearch" placeholder="Premier, Champions, Serie A..." />
          </label>
          <label>
            Temporada
            <input [(ngModel)]="season" type="number" min="2008" max="2030" />
          </label>
          <button
            pButton
            type="button"
            icon="pi pi-search"
            label="Buscar"
            [loading]="loadingLeagues()"
            (click)="loadLeagues()"
          ></button>
        </div>

        <div class="w-full overflow-x-auto">
          <p-table [value]="leagues()" [loading]="loadingLeagues()" styleClass="min-w-[620px]">
            <ng-template pTemplate="header">
              <tr>
                <th>Liga</th>
                <th>Pais</th>
                <th>Seleccion</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-league>
              <tr>
                <td>
                  <div class="league-chip">
                    <img [src]="league.league.logo || league.country.flag || 'favicon.ico'" alt="" />
                    <span>{{ league.league.name }}</span>
                  </div>
                </td>
                <td>{{ league.country.name }}</td>
                <td>
                  <p-checkbox
                    [binary]="true"
                    [ngModel]="isLeagueSelected(league.league.id)"
                    (onChange)="toggleLeague(league)"
                  ></p-checkbox>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>

        <div class="dialog-actions">
          <button
            pButton
            type="button"
            icon="pi pi-calendar"
            label="Cargar partidos de ligas seleccionadas"
            [disabled]="!selectedLeagues().length"
            (click)="openFixturesDialog()"
          ></button>
        </div>
      </p-dialog>

      <p-dialog
        header="Seleccionar partidos"
        [modal]="true"
        [visible]="fixturesDialogOpen()"
        (visibleChange)="fixturesDialogOpen.set($event)"
        [style]="{ width: 'min(96vw, 920px)' }"
      >
        <div class="panel-heading dialog-heading !flex flex-col items-stretch gap-3 lg:!flex-row lg:items-center lg:justify-between">
          <div class="min-w-0">
            <p class="eyebrow">{{ selectedLeagues().length }} liga(s)</p>
            <h2>Partidos disponibles</h2>
          </div>
          <div class="toolbar-actions !flex flex-col items-stretch gap-2 sm:!flex-row sm:flex-wrap sm:items-center">
            <button
              pButton
              type="button"
              icon="pi pi-angle-down"
              label="Desplegar"
              severity="secondary"
              variant="outlined"
              (click)="expandAllFixtureGroups()"
            ></button>
            <button
              pButton
              type="button"
              icon="pi pi-angle-up"
              label="Encoger"
              severity="secondary"
              variant="outlined"
              (click)="collapseAllFixtureGroups()"
            ></button>
            <button
              pButton
              type="button"
              icon="pi pi-refresh"
              label="Cargar"
              [loading]="loadingFixtures()"
              (click)="loadFixtures()"
            ></button>
          </div>
        </div>

        @if (loadingFixtures()) {
          <p class="muted-copy">Cargando partidos...</p>
        }

        <div class="fixture-groups">
          @for (group of fixtureGroups(); track group.leagueId) {
            <section class="fixture-group">
              <button type="button" class="fixture-group-header" (click)="toggleFixtureGroup(group.leagueId)">
                <span class="league-chip">
                  <img [src]="group.logoUrl || 'favicon.ico'" alt="" />
                  <span>{{ group.leagueName }}</span>
                </span>
                <small>{{ group.fixtures.length }} partido(s)</small>
                <i
                  class="pi"
                  [class.pi-angle-down]="!isFixtureGroupCollapsed(group.leagueId)"
                  [class.pi-angle-right]="isFixtureGroupCollapsed(group.leagueId)"
                  aria-hidden="true"
                ></i>
              </button>

              @if (!isFixtureGroupCollapsed(group.leagueId)) {
                <div class="fixture-group-body">
                  @for (fixture of group.fixtures; track fixture.fixture.id) {
                    <article class="available-fixture-row !grid grid-cols-1 gap-3 lg:!grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                      <div class="match-cell">
                        <span class="team-line">
                          <img [src]="fixture.teams.home.logo || 'favicon.ico'" alt="" />
                          <strong>{{ fixture.teams.home.name }}</strong>
                        </span>
                        <span class="versus">vs</span>
                        <span class="team-line">
                          <img [src]="fixture.teams.away.logo || 'favicon.ico'" alt="" />
                          <strong>{{ fixture.teams.away.name }}</strong>
                        </span>
                      </div>
                      <small>{{ fixture.fixture.date | date: 'dd/MM/yyyy HH:mm' }}</small>
                      <button
                        pButton
                        type="button"
                        icon="pi pi-plus"
                        label="Agregar"
                        [disabled]="isInBasket(fixture.fixture.id)"
                        (click)="addFixture(fixture)"
                      ></button>
                    </article>
                  }
                </div>
              }
            </section>
          } @empty {
            <p class="muted-copy">No hay partidos cargados para las ligas seleccionadas.</p>
          }
        </div>
      </p-dialog>

      <p-dialog
        header="Plantilla global"
        [modal]="true"
        [visible]="settingsDialogOpen()"
        (visibleChange)="settingsDialogOpen.set($event)"
        [style]="{ width: 'min(94vw, 820px)' }"
      >
        <p class="muted-copy">
          Esta configuracion se aplica a todos los partidos nuevos y a los partidos que no tengan
          mercados personalizados.
        </p>

        <div class="market-grid prime-market-grid !grid grid-cols-1 gap-3 md:!grid-cols-2 xl:!grid-cols-3">
          @for (market of markets(); track market.key) {
            <label class="market-option prime-market-option" [for]="'global-' + market.key">
              <p-checkbox
                [inputId]="'global-' + market.key"
                [binary]="true"
                [ngModel]="defaultMarkets().includes(market.key)"
                (onChange)="toggleDefaultMarket(market.key)"
              ></p-checkbox>
              <span>
                <strong>{{ market.label }}</strong>
                <small>{{ market.description }}</small>
              </span>
            </label>
          }
        </div>

        <div class="basket-settings !grid grid-cols-1 gap-3 md:!grid-cols-[minmax(0,1fr)_160px_auto]">
          <label>
            Historico global
            <input [(ngModel)]="historyDepth" type="number" min="3" max="30" />
          </label>
          <label>
            Canal
            <select [(ngModel)]="deliveryChannel">
              <option value="APP">App</option>
              <option value="TELEGRAM">Telegram</option>
              <option value="BOTH">Ambos</option>
            </select>
          </label>
          <label class="check-row prime-check-row" for="include-excel">
            <p-checkbox inputId="include-excel" [binary]="true" [(ngModel)]="includeExcel"></p-checkbox>
            Excel opcional
          </label>
        </div>

        <label>
          Mensaje para aprobador
          <textarea [(ngModel)]="message" rows="3"></textarea>
        </label>

        <div class="dialog-actions">
          <button
            pButton
            type="button"
            icon="pi pi-check"
            label="Listo"
            (click)="settingsDialogOpen.set(false)"
          ></button>
        </div>
      </p-dialog>

      <p-dialog
        header="Mercados del partido"
        [modal]="true"
        [visible]="itemDialogOpen()"
        (visibleChange)="itemDialogOpen.set($event)"
        [style]="{ width: 'min(94vw, 720px)' }"
      >
        @if (activeItem()) {
          <div class="selected-league min-w-0">
            <img [src]="activeItem()?.homeTeamLogoUrl || 'favicon.ico'" alt="" />
            <span class="min-w-0">
              <strong>{{ activeItem()?.homeTeamName }} vs {{ activeItem()?.awayTeamName }}</strong>
              <small>
                {{
                  activeItem()?.marketsOverride?.length
                    ? 'Este partido tiene mercados personalizados.'
                    : 'Este partido usa la plantilla global.'
                }}
              </small>
            </span>
          </div>

          <div class="dialog-actions reset-template-action">
            <button
              pButton
              type="button"
              icon="pi pi-refresh"
              label="Usar plantilla global"
              severity="secondary"
              variant="outlined"
              [disabled]="!activeItem()?.marketsOverride?.length"
              (click)="resetItemTemplate(activeItem()!.fixtureId)"
            ></button>
          </div>

          <div class="market-grid prime-market-grid !grid grid-cols-1 gap-3 md:!grid-cols-2 xl:!grid-cols-3">
            @for (market of markets(); track market.key) {
              <label class="market-option prime-market-option" [for]="'item-' + activeItem()?.fixtureId + '-' + market.key">
                <p-checkbox
                  [inputId]="'item-' + activeItem()?.fixtureId + '-' + market.key"
                  [binary]="true"
                  [ngModel]="itemMarkets(activeItem()!.fixtureId).includes(market.key)"
                  (onChange)="toggleItemMarket(activeItem()!.fixtureId, market.key)"
                ></p-checkbox>
                <span>
                  <strong>{{ market.label }}</strong>
                  <small>{{ market.description }}</small>
                </span>
              </label>
            }
          </div>

          <label>
            Historico del partido
            <input
              type="number"
              min="3"
              max="30"
              [ngModel]="activeItem()?.historyDepthOverride ?? historyDepth"
              (ngModelChange)="setItemHistory(activeItem()!.fixtureId, $event)"
            />
          </label>
        }
      </p-dialog>
    </main>
  `,
})
export class BasketComponent implements OnInit {
  readonly basket = inject(BasketService);
  private readonly football = inject(FootballService);
  private readonly marketsService = inject(MarketsService);
  private readonly requests = inject(AnalysisRequestsService);
  private readonly router = inject(Router);

  readonly markets = signal<Market[]>([]);
  readonly leagues = signal<FootballLeague[]>([]);
  readonly fixtures = signal<FootballFixture[]>([]);
  readonly selectedLeagues = signal<FootballLeague[]>([]);
  readonly leagueDialogOpen = signal(false);
  readonly fixturesDialogOpen = signal(false);
  readonly settingsDialogOpen = signal(false);
  readonly itemDialogOpen = signal(false);
  readonly activeFixtureId = signal<number | null>(null);
  readonly collapsedFixtureGroups = signal<number[]>([]);
  readonly loadingLeagues = signal(false);
  readonly loadingFixtures = signal(false);
  readonly defaultMarkets = signal<string[]>(['OVER_UNDER_25', 'BTTS']);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly activeItem = computed(() =>
    this.basket.items().find((item) => item.fixtureId === this.activeFixtureId()) ?? null,
  );
  readonly fixtureGroups = computed(() => {
    const groups = new Map<
      number,
      { leagueId: number; leagueName: string; logoUrl: string | null; fixtures: FootballFixture[] }
    >();

    this.fixtures().forEach((fixture) => {
      const leagueId = fixture.league.id;
      const existing = groups.get(leagueId);

      if (existing) {
        existing.fixtures.push(fixture);
        return;
      }

      groups.set(leagueId, {
        leagueId,
        leagueName: fixture.league.name,
        logoUrl: fixture.league.logo,
        fixtures: [fixture],
      });
    });

    return [...groups.values()].sort((left, right) =>
      left.leagueName.localeCompare(right.leagueName),
    );
  });
  readonly estimatedCalls = computed(() => {
    const heavy = this.basket
      .items()
      .filter((item) =>
        this.effectiveMarkets(item.fixtureId).some((market) =>
          [
            'CORNERS',
            'TOTAL_SHOTS',
            'SHOTS_ON_TARGET',
            'CARDS',
            'YELLOW_CARDS',
            'RED_CARDS',
          ].includes(market),
        ),
      ).length;
    const scorers = this.basket
      .items()
      .filter((item) => this.effectiveMarkets(item.fixtureId).includes('SCORER')).length;

    return this.basket.items().length * 7 + heavy * 16 + scorers * 12;
  });

  leagueSearch = 'Premier';
  season = new Date().getFullYear();
  historyDepth = 10;
  includeExcel = false;
  deliveryChannel: 'APP' | 'TELEGRAM' | 'BOTH' = 'APP';
  message = '';

  ngOnInit() {
    this.marketsService.findAll().subscribe({
      next: (markets) => this.markets.set(markets),
      error: () => this.error.set('No se pudieron cargar mercados.'),
    });
  }

  openLeagueDialog() {
    this.leagueDialogOpen.set(true);
    this.error.set('');
  }

  openFixturesDialog() {
    this.fixturesDialogOpen.set(true);
    this.leagueDialogOpen.set(false);
    this.error.set('');

    if (!this.fixtures().length) {
      this.loadFixtures();
    }
  }

  loadLeagues() {
    this.loadingLeagues.set(true);
    this.error.set('');
    this.football
      .leagues(this.leagueSearch, Number(this.season))
      .pipe(finalize(() => this.loadingLeagues.set(false)))
      .subscribe({
        next: (response) => this.leagues.set(response.response),
        error: () => this.error.set('No se pudieron cargar ligas.'),
      });
  }

  isLeagueSelected(leagueId: number) {
    return this.selectedLeagues().some((league) => league.league.id === leagueId);
  }

  toggleLeague(league: FootballLeague) {
    this.fixtures.set([]);
    this.selectedLeagues.set(
      this.isLeagueSelected(league.league.id)
        ? this.selectedLeagues().filter((selected) => selected.league.id !== league.league.id)
        : [...this.selectedLeagues(), league],
    );
  }

  removeLeague(leagueId: number) {
    this.fixtures.set([]);
    this.selectedLeagues.set(
      this.selectedLeagues().filter((league) => league.league.id !== leagueId),
    );
  }

  loadFixtures() {
    const leagues = this.selectedLeagues();

    if (!leagues.length) {
      return;
    }

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 14);
    this.loadingFixtures.set(true);
    this.error.set('');
    const requests = leagues.map((league) =>
      this.football.fixtures(league.league.id, Number(this.season), this.isoDate(from), this.isoDate(to)),
    );

    Promise.all(requests.map((request) => new Promise<FootballFixture[]>((resolve, reject) => {
      request.subscribe({
        next: (response) => resolve(response.response),
        error: reject,
      });
    })))
      .then((groups) => {
        const fixtures = groups
          .flat()
          .sort((left, right) => left.fixture.date.localeCompare(right.fixture.date));

        this.fixtures.set(fixtures);
        this.collapsedFixtureGroups.set([]);
      })
      .catch(() => this.error.set('No se pudieron cargar partidos.'))
      .finally(() => this.loadingFixtures.set(false));
  }

  addFixture(fixture: FootballFixture) {
    this.basket.add({
      fixtureId: fixture.fixture.id,
      leagueId: fixture.league.id,
      leagueName: fixture.league.name,
      leagueLogoUrl: fixture.league.logo,
      season: fixture.league.season,
      date: fixture.fixture.date,
      homeTeamId: fixture.teams.home.id,
      homeTeamName: fixture.teams.home.name,
      homeTeamLogoUrl: fixture.teams.home.logo,
      awayTeamId: fixture.teams.away.id,
      awayTeamName: fixture.teams.away.name,
      awayTeamLogoUrl: fixture.teams.away.logo,
    });
  }

  isInBasket(fixtureId: number) {
    return this.basket.items().some((item) => item.fixtureId === fixtureId);
  }

  isFixtureGroupCollapsed(leagueId: number) {
    return this.collapsedFixtureGroups().includes(leagueId);
  }

  toggleFixtureGroup(leagueId: number) {
    this.collapsedFixtureGroups.set(
      this.isFixtureGroupCollapsed(leagueId)
        ? this.collapsedFixtureGroups().filter((current) => current !== leagueId)
        : [...this.collapsedFixtureGroups(), leagueId],
    );
  }

  expandAllFixtureGroups() {
    this.collapsedFixtureGroups.set([]);
  }

  collapseAllFixtureGroups() {
    this.collapsedFixtureGroups.set(this.fixtureGroups().map((group) => group.leagueId));
  }

  canSubmit() {
    return this.basket.items().length > 0 && this.defaultMarkets().length > 0;
  }

  toggleDefaultMarket(market: string) {
    const current = this.defaultMarkets();
    this.defaultMarkets.set(
      current.includes(market)
        ? current.filter((selected) => selected !== market)
        : [...current, market],
    );
  }

  openItemDialog(fixtureId: number) {
    this.activeFixtureId.set(fixtureId);
    this.itemDialogOpen.set(true);
  }

  itemMarkets(fixtureId: number) {
    return this.effectiveMarkets(fixtureId);
  }

  toggleItemMarket(fixtureId: number, market: string) {
    const item = this.basket.items().find((current) => current.fixtureId === fixtureId);
    const current = item?.marketsOverride?.length
      ? item.marketsOverride
      : [...this.defaultMarkets()];
    const next = current.includes(market)
      ? current.filter((selected) => selected !== market)
      : [...current, market];

    this.basket.update(fixtureId, { marketsOverride: next });
  }

  setItemHistory(fixtureId: number, value: number) {
    this.basket.update(fixtureId, { historyDepthOverride: Number(value) });
  }

  resetItemTemplate(fixtureId: number) {
    this.basket.update(fixtureId, {
      marketsOverride: undefined,
      historyDepthOverride: undefined,
    });
  }

  submit() {
    this.submitting.set(true);
    this.error.set('');
    this.requests
      .create({
        defaultMarkets: this.defaultMarkets(),
        historyDepth: Number(this.historyDepth),
        includeExcel: this.includeExcel,
        deliveryChannel: this.deliveryChannel,
        message: this.message || undefined,
        items: this.basket.items(),
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.basket.clear();
          void this.router.navigateByUrl('/requests');
        },
        error: () => this.error.set('No se pudo enviar la solicitud.'),
      });
  }

  private effectiveMarkets(fixtureId: number) {
    const item = this.basket.items().find((current) => current.fixtureId === fixtureId);
    return item?.marketsOverride?.length ? item.marketsOverride : this.defaultMarkets();
  }

  private isoDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
