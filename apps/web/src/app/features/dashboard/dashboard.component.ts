import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [ButtonModule],
  template: `
    <main class="app-shell">
      <aside class="layout-sidebar">
        <div class="brand-lockup">
          <span class="brand-mark">SF</span>
          <div>
            <strong>StatsForge</strong>
            <span>Analytics local</span>
          </div>
        </div>

        <nav class="layout-menu" aria-label="Navegacion principal">
          <a class="menu-item active">
            <i class="pi pi-home" aria-hidden="true"></i>
            <span>Inicio</span>
          </a>
          <a class="menu-item">
            <i class="pi pi-chart-line" aria-hidden="true"></i>
            <span>Explorer</span>
          </a>
          <a class="menu-item">
            <i class="pi pi-database" aria-hidden="true"></i>
            <span>Canasta</span>
          </a>
          @if (auth.hasRole('ADMIN', 'ANALYST')) {
            <a class="menu-item">
              <i class="pi pi-inbox" aria-hidden="true"></i>
              <span>Solicitudes</span>
            </a>
          }
          @if (auth.hasRole('ADMIN')) {
            <a class="menu-item">
              <i class="pi pi-users" aria-hidden="true"></i>
              <span>Usuarios</span>
            </a>
          }
        </nav>

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

      <section class="layout-main">
        <header class="topbar">
          <div>
            <p class="eyebrow">Panel operativo</p>
            <h1>Inicio</h1>
          </div>

          <div class="user-chip" aria-label="Sesion activa">
            <span>{{ initials() }}</span>
            <div>
              <strong>{{ auth.user()?.name }}</strong>
              <small>{{ auth.user()?.role }}</small>
            </div>
          </div>
        </header>

        <section class="metric-grid" aria-label="Resumen">
          <article class="metric-card">
            <span class="metric-icon success">
              <i class="pi pi-check-circle" aria-hidden="true"></i>
            </span>
            <div>
              <p>Sesion</p>
              <strong>Activa</strong>
            </div>
          </article>

          <article class="metric-card">
            <span class="metric-icon info">
              <i class="pi pi-user" aria-hidden="true"></i>
            </span>
            <div>
              <p>Usuario</p>
              <strong>{{ auth.user()?.email }}</strong>
            </div>
          </article>

          <article class="metric-card">
            <span class="metric-icon warning">
              <i class="pi pi-lock" aria-hidden="true"></i>
            </span>
            <div>
              <p>Acceso</p>
              <strong>{{ auth.user()?.role }}</strong>
            </div>
          </article>
        </section>

        <section class="content-grid">
          <article class="work-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Siguiente modulo</p>
                <h2>Gestion de usuarios</h2>
              </div>
              @if (auth.hasRole('ADMIN')) {
                <button
                  pButton
                  type="button"
                  icon="pi pi-user-plus"
                  label="Invitar"
                ></button>
              }
            </div>

            <div class="empty-state">
              <i class="pi pi-users" aria-hidden="true"></i>
              <p>La tabla de usuarios se conectara con el backend existente.</p>
            </div>
          </article>

          <aside class="work-panel compact">
            <p class="eyebrow">Estado</p>
            <h2>Fase 1</h2>
            <ul class="status-list">
              <li>
                <i class="pi pi-check" aria-hidden="true"></i>
                Auth conectado
              </li>
              <li>
                <i class="pi pi-check" aria-hidden="true"></i>
                Layout base activo
              </li>
              <li>
                <i class="pi pi-circle" aria-hidden="true"></i>
                Usuarios pendiente
              </li>
            </ul>
          </aside>
        </section>
      </section>
    </main>
  `,
})
export class DashboardComponent {
  constructor(readonly auth: AuthService) {}

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
