import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  imports: [ButtonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="app-shell !grid min-h-dvh grid-cols-1 bg-slate-100 md:!grid-cols-[292px_minmax(0,1fr)]">
      <aside
        class="layout-sidebar !flex min-h-auto flex-col gap-4 border-b border-slate-200 bg-slate-950 p-4 text-white md:min-h-dvh md:border-b-0 md:border-r md:border-slate-800 md:p-6"
      >
        <div class="brand-lockup min-w-0">
          <span class="brand-mark">SF</span>
          <div class="min-w-0">
            <strong>StatsForge</strong>
            <span>Analytics local</span>
          </div>
        </div>

        <nav class="layout-menu !flex gap-2 overflow-x-auto md:!grid md:overflow-visible" aria-label="Navegacion principal">
          <a
            class="menu-item shrink-0"
            routerLink="/basket"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <i class="pi pi-shopping-cart" aria-hidden="true"></i>
            <span>Generador</span>
          </a>
          <a
            class="menu-item shrink-0"
            routerLink="/explorer"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <i class="pi pi-search" aria-hidden="true"></i>
            <span>Explorer</span>
          </a>
          <a
            class="menu-item shrink-0"
            routerLink="/requests"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <i class="pi pi-inbox" aria-hidden="true"></i>
            <span>{{ auth.hasRole('ADMIN', 'ANALYST') ? 'Bandeja' : 'Mis solicitudes' }}</span>
          </a>
          @if (auth.hasRole('ADMIN')) {
            <a
              class="menu-item shrink-0"
              routerLink="/users"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
            >
              <i class="pi pi-users" aria-hidden="true"></i>
              <span>Usuarios</span>
            </a>
          }
        </nav>

        <div class="sidebar-user min-w-0 md:mt-auto">
          <span>{{ initials() }}</span>
          <div class="min-w-0">
            <strong class="truncate">{{ auth.user()?.name }}</strong>
            <small>{{ auth.user()?.role }}</small>
          </div>
        </div>

        <button
          pButton
          type="button"
          severity="secondary"
          variant="outlined"
          icon="pi pi-sign-out"
          label="Salir"
          (click)="auth.logout()"
        ></button>
      </aside>

      <section class="layout-content min-w-0">
        <router-outlet />
      </section>
    </main>
  `,
})
export class MainLayoutComponent {
  readonly auth = inject(AuthService);

  initials() {
    const name = this.auth.user()?.name?.trim();

    if (!name) {
      return 'SF';
    }

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
}
