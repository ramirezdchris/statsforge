import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { AppUser, InviteUserRequest } from '../../core/models/user.models';
import { UsersService } from '../../core/services/users.service';

@Component({
  selector: 'app-users',
  imports: [ButtonModule, DatePipe, DialogModule, ReactiveFormsModule, TableModule],
  template: `
    <main class="layout-main">
      <header class="topbar">
        <div>
          <p class="eyebrow">Administracion</p>
          <h1>Usuarios</h1>
        </div>
        <button
          pButton
          type="button"
          icon="pi pi-user-plus"
          label="Invitar"
          (click)="openInviteDialog()"
        ></button>
      </header>

      @if (usersError()) {
        <p class="inline-error">{{ usersError() }}</p>
      }

      <section class="work-panel">
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
export class UsersComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly usersService = inject(UsersService);

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

  ngOnInit() {
    this.loadUsers();
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
          this.temporaryPasswordLabel.set(
            `Password temporal para ${response.user.email}`,
          );
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
    this.temporaryPasswordLabel.set(
      `Generando password temporal para ${user.email}`,
    );
    this.resetLoadingUserId.set(user.id);

    this.usersService
      .resetPassword(user.id)
      .pipe(finalize(() => this.resetLoadingUserId.set(null)))
      .subscribe({
        next: (response) => {
          this.temporaryPasswordLabel.set(
            `Password temporal para ${response.user.email}`,
          );
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
        error: (error: unknown) => {
          this.usersError.set(this.errorMessage(error));
        },
      });
  }

  private errorMessage(error: unknown) {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message ?? 'No se pudo completar la accion.';
    }

    return 'No se pudo completar la accion.';
  }
}
