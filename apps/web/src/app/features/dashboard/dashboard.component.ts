import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  template: `
    <main class="app-shell">
      <aside class="sidebar">
        <div>
          <p class="eyebrow">StatsForge</p>
          <h1>Panel</h1>
        </div>
        <nav>
          <a class="nav-item active">Inicio</a>
          <a class="nav-item muted">Explorer</a>
          <a class="nav-item muted">Canasta</a>
          @if (auth.hasRole('ADMIN', 'ANALYST')) {
            <a class="nav-item muted">Solicitudes</a>
          }
          @if (auth.hasRole('ADMIN')) {
            <a class="nav-item muted">Usuarios</a>
          }
        </nav>
        <button type="button" class="secondary-button" (click)="auth.logout()">
          Salir
        </button>
      </aside>

      <section class="workspace">
        <p class="eyebrow">Sesion activa</p>
        <h2>{{ auth.user()?.name }}</h2>
        <dl class="session-grid">
          <div>
            <dt>Email</dt>
            <dd>{{ auth.user()?.email }}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{{ auth.user()?.role }}</dd>
          </div>
        </dl>
      </section>
    </main>
  `,
})
export class DashboardComponent {
  constructor(readonly auth: AuthService) {}
}
