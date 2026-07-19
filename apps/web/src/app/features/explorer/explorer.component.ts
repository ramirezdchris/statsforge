import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { BasketService } from '../../core/services/basket.service';
import { FootballService } from '../../core/services/football.service';
import { FootballFixture, FootballLeague } from '../../core/models/football.models';

@Component({
  selector: 'app-explorer',
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <main class="layout-main">
      <header class="topbar">
        <div>
          <p class="eyebrow">Explorer</p>
          <h1>Ligas y partidos</h1>
        </div>
        <a class="text-button" routerLink="/basket">Canasta ({{ basketCount() }})</a>
      </header>

      <section class="work-panel explorer-tools">
        <label>
          Buscar liga
          <input [(ngModel)]="leagueSearch" placeholder="Premier, Champions, Liga..." />
        </label>
        <label>
          Temporada
          <input [(ngModel)]="season" type="number" min="2008" max="2030" />
        </label>
        <button type="button" (click)="loadLeagues()" [disabled]="loadingLeagues()">
          {{ loadingLeagues() ? 'Buscando...' : 'Buscar' }}
        </button>
      </section>

      @if (error()) {
        <p class="inline-error">{{ error() }}</p>
      }

      <section class="content-grid explorer-grid">
        <article class="work-panel">
          <div class="panel-heading">
            <h2>Ligas</h2>
          </div>
          <div class="entity-list">
            @for (league of leagues(); track league.league.id) {
              <button
                type="button"
                class="entity-row"
                [class.active]="selectedLeague()?.league?.id === league.league.id"
                (click)="selectLeague(league)"
              >
                <img [src]="league.league.logo || league.country.flag || 'favicon.ico'" alt="" />
                <span>
                  <strong>{{ league.league.name }}</strong>
                  <small>{{ league.country.name }} · {{ league.league.type }}</small>
                </span>
              </button>
            } @empty {
              <p class="muted-copy">Busca una liga para empezar.</p>
            }
          </div>
        </article>

        <article class="work-panel">
          <div class="panel-heading">
            <h2>Partidos</h2>
            @if (selectedLeague()) {
              <button type="button" (click)="loadFixtures()" [disabled]="loadingFixtures()">
                {{ loadingFixtures() ? 'Cargando...' : 'Cargar próximos' }}
              </button>
            }
          </div>

          <div class="fixture-list">
            @for (fixture of fixtures(); track fixture.fixture.id) {
              <article class="fixture-row">
                <div class="team-line">
                  <img [src]="fixture.teams.home.logo || 'favicon.ico'" alt="" />
                  <strong>{{ fixture.teams.home.name }}</strong>
                </div>
                <span class="versus">vs</span>
                <div class="team-line">
                  <img [src]="fixture.teams.away.logo || 'favicon.ico'" alt="" />
                  <strong>{{ fixture.teams.away.name }}</strong>
                </div>
                <small>{{ fixture.fixture.date | date: 'dd/MM/yyyy HH:mm' }}</small>
                <button type="button" (click)="addFixture(fixture)">Añadir</button>
              </article>
            } @empty {
              <p class="muted-copy">Selecciona una liga y carga partidos.</p>
            }
          </div>
        </article>
      </section>
    </main>
  `,
})
export class ExplorerComponent {
  private readonly football = inject(FootballService);
  private readonly basket = inject(BasketService);

  readonly leagues = signal<FootballLeague[]>([]);
  readonly fixtures = signal<FootballFixture[]>([]);
  readonly selectedLeague = signal<FootballLeague | null>(null);
  readonly loadingLeagues = signal(false);
  readonly loadingFixtures = signal(false);
  readonly error = signal('');
  readonly basketCount = computed(() => this.basket.items().length);

  leagueSearch = 'Premier';
  season = new Date().getFullYear();

  loadLeagues() {
    this.loadingLeagues.set(true);
    this.error.set('');
    this.football
      .leagues(this.leagueSearch, this.season)
      .pipe(finalize(() => this.loadingLeagues.set(false)))
      .subscribe({
        next: (response) => this.leagues.set(response.response),
        error: () => this.error.set('No se pudieron cargar ligas. Revisa API key/cuota.'),
      });
  }

  selectLeague(league: FootballLeague) {
    this.selectedLeague.set(league);
    this.fixtures.set([]);
  }

  loadFixtures() {
    const league = this.selectedLeague();

    if (!league) {
      return;
    }

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 14);

    this.loadingFixtures.set(true);
    this.error.set('');
    this.football
      .fixtures(league.league.id, this.season, this.isoDate(from), this.isoDate(to))
      .pipe(finalize(() => this.loadingFixtures.set(false)))
      .subscribe({
        next: (response) => this.fixtures.set(response.response),
        error: () => this.error.set('No se pudieron cargar partidos.'),
      });
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

  private isoDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
