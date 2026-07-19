import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { AppUser, InviteUserRequest } from '../../core/models/user.models';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';

@Component({
  selector: 'app-dashboard',
  imports: [ButtonModule, DatePipe, DialogModule, ReactiveFormsModule, RouterLink, TableModule],
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
          <a class="menu-item active" routerLink="/app">
            <i class="pi pi-home" aria-hidden="true"></i>
            <span>Inicio</span>
          </a>
          <a class="menu-item" routerLink="/basket">
            <i class="pi pi-chart-line" aria-hidden="true"></i>
            <span>Generador</span>
          </a>
          @if (auth.hasRole('ADMIN', 'ANALYST')) {
            <a class="menu-item" routerLink="/requests">
              <i class="pi pi-inbox" aria-hidden="true"></i>
              <span>Bandeja</span>
            </a>
          } @else {
            <a class="menu-item" routerLink="/requests">
              <i class="pi pi-inbox" aria-hidden="true"></i>
              <span>Mis solicitudes</span>
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
          @if (auth.hasRole('ADMIN')) {
            <article class="work-panel">
              <div class="panel-heading">
                <div>
                  <p class="eyebrow">Administracion</p>
                  <h2>Gestion de usuarios</h2>
                </div>
                <button
                  pButton
                  type="button"
                  icon="pi pi-user-plus"
                  label="Invitar"
                  (click)="openInviteDialog()"
                ></button>
              </div>

              @if (usersError()) {
                <p class="inline-error">{{ usersError() }}</p>
              }

              <p-table
                [value]="users()"
                [loading]="usersLoading()"
                [paginator]="users().length > 8"
                [rows]="8"
                responsiveLayout="stack"
                styleClass="users-table"
              >
                <ng-template pTemplate="header">
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Ultimo acceso</th>
                    <th>Acciones</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-user>
                  <tr>
                    <td>
                      <strong>{{ user.name }}</strong>
                      <span>{{ user.email }}</span>
                    </td>
                    <td>
                      <span class="role-badge">{{ user.role }}</span>
                    </td>
                    <td>
                      <span class="status-badge" [class.inactive]="!user.isActive">
                        {{ user.isActive ? 'Activo' : 'Inactivo' }}
                      </span>
                      @if (user.mustChangePassword) {
                        <small class="password-flag">Cambio pendiente</small>
                      }
                    </td>
                    <td>
                      {{
                        user.lastLoginAt
                          ? (user.lastLoginAt | date: 'dd/MM/yyyy HH:mm')
                          : 'Sin acceso'
                      }}
                    </td>
                    <td>
                      <button
                        pButton
                        type="button"
                        severity="secondary"
                        variant="outlined"
                        icon="pi pi-key"
                        label="Reset"
                        [disabled]="resetLoadingUserId() === user.id"
                        [loading]="resetLoadingUserId() === user.id"
                        (click)="resetUserPassword(user)"
                      ></button>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="5">No hay usuarios registrados.</td>
                  </tr>
                </ng-template>
              </p-table>
            </article>
          } @else {
            <article class="work-panel">
              <div class="panel-heading">
                <div>
                  <p class="eyebrow">Area de trabajo</p>
                  <h2>{{ workspaceTitle() }}</h2>
                </div>
              </div>

              <div class="empty-state">
                <i class="pi pi-chart-line" aria-hidden="true"></i>
                <p>{{ workspaceMessage() }}</p>
              </div>
            </article>
          }

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
                <i class="pi pi-check" aria-hidden="true"></i>
                Usuarios conectado
              </li>
            </ul>
          </aside>
        </section>
      </section>

      <p-dialog
        header="Invitar usuario"
        [modal]="true"
        [visible]="inviteDialogOpen()"
        (visibleChange)="inviteDialogOpen.set($event)"
        [style]="{ width: 'min(92vw, 460px)' }"
      >
        <form class="invite-form" [formGroup]="inviteForm" (ngSubmit)="inviteUser()">
          <label>
            Nombre
            <input type="text" formControlName="name" autocomplete="name" />
          </label>

          <label>
            Email
            <input type="email" formControlName="email" autocomplete="email" />
          </label>

          <label>
            Rol
            <select formControlName="role">
              <option value="ANALYST">ANALYST</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </label>

          @if (inviteError()) {
            <p class="form-error">{{ inviteError() }}</p>
          }

          @if (temporaryPassword()) {
            <div class="temporary-password">
              <span>{{ temporaryPasswordLabel() }}</span>
              <strong>{{ temporaryPassword() }}</strong>
              <small>Este valor solo se muestra una vez.</small>
            </div>
          }

          <div class="dialog-actions">
            <button
              pButton
              type="button"
              severity="secondary"
              variant="outlined"
              label="Cerrar"
              (click)="closeInviteDialog()"
            ></button>
            <button
              pButton
              type="submit"
              icon="pi pi-send"
              label="Invitar"
              [disabled]="inviteForm.invalid || inviteLoading()"
              [loading]="inviteLoading()"
            ></button>
          </div>
        </form>
      </p-dialog>
    </main>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly users = signal<AppUser[]>([]);
  readonly usersLoading = signal(false);
  readonly usersError = signal<string | null>(null);
  readonly inviteDialogOpen = signal(false);
  readonly inviteLoading = signal(false);
  readonly inviteError = signal<string | null>(null);
  readonly temporaryPassword = signal<string | null>(null);
  readonly temporaryPasswordLabel = signal('Password temporal');
  readonly resetLoadingUserId = signal<string | null>(null);
  readonly inviteForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['VIEWER' as InviteUserRequest['role'], [Validators.required]],
  });

  constructor(
    readonly auth: AuthService,
    private readonly usersService: UsersService,
  ) {}

  ngOnInit() {
    if (this.auth.hasRole('ADMIN')) {
      this.loadUsers();
    }
  }

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

  workspaceTitle() {
    return this.auth.hasRole('ANALYST') ? 'Solicitudes asignadas' : 'Explorer';
  }

  workspaceMessage() {
    return this.auth.hasRole('ANALYST')
      ? 'Aun no hay solicitudes listas para revisar.'
      : 'Aun no hay datos cargados para explorar.';
  }

  openInviteDialog() {
    this.inviteDialogOpen.set(true);
    this.inviteError.set(null);
    this.temporaryPassword.set(null);
    this.temporaryPasswordLabel.set('Password temporal');
  }

  closeInviteDialog() {
    this.inviteDialogOpen.set(false);
    this.inviteForm.reset({ name: '', email: '', role: 'VIEWER' });
    this.inviteError.set(null);
    this.temporaryPassword.set(null);
    this.temporaryPasswordLabel.set('Password temporal');
  }

  inviteUser() {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    this.inviteLoading.set(true);
    this.inviteError.set(null);
    this.temporaryPassword.set(null);

    this.usersService
      .invite(this.inviteForm.getRawValue())
      .pipe(finalize(() => this.inviteLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.temporaryPasswordLabel.set(`Password temporal para ${response.user.email}`);
          this.temporaryPassword.set(response.temporaryPassword);
          this.inviteForm.reset({ name: '', email: '', role: 'VIEWER' });
          this.loadUsers();
        },
        error: (error: unknown) => {
          this.inviteError.set(this.errorMessage(error));
        },
      });
  }

  resetUserPassword(user: AppUser) {
    this.inviteDialogOpen.set(true);
    this.inviteError.set(null);
    this.temporaryPassword.set(null);
    this.temporaryPasswordLabel.set(`Generando password temporal para ${user.email}`);
    this.resetLoadingUserId.set(user.id);

    this.usersService
      .resetPassword(user.id)
      .pipe(finalize(() => this.resetLoadingUserId.set(null)))
      .subscribe({
        next: (response) => {
          this.temporaryPasswordLabel.set(`Password temporal para ${response.user.email}`);
          this.temporaryPassword.set(response.temporaryPassword);
          this.loadUsers();
        },
        error: (error: unknown) => {
          this.inviteError.set(this.errorMessage(error));
        },
      });
  }

  private loadUsers() {
    this.usersLoading.set(true);
    this.usersError.set(null);

    this.usersService
      .findAll()
      .pipe(finalize(() => this.usersLoading.set(false)))
      .subscribe({
        next: (users) => this.users.set(users),
        error: (error: unknown) => this.usersError.set(this.errorMessage(error)),
      });
  }

  private errorMessage(error: unknown) {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }

    return 'No se pudo completar la operacion.';
  }
}
