import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule],
  template: `
    <main class="auth-shell">
      <section class="auth-panel">
        <p class="eyebrow">Primer acceso</p>
        <h1>Cambia tu password</h1>
        <p class="lead">
          El password temporal solo sirve para entrar una vez. Define uno nuevo
          para activar el acceso completo.
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
          <label>
            Password actual
            <input
              type="password"
              formControlName="currentPassword"
              autocomplete="current-password"
            />
          </label>

          <label>
            Nuevo password
            <input
              type="password"
              formControlName="newPassword"
              autocomplete="new-password"
            />
          </label>

          @if (error()) {
            <p class="form-error">{{ error() }}</p>
          }

          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Guardando...' : 'Guardar password' }}
          </button>
        </form>
      </section>
    </main>
  `,
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid || this.loading()) {
      return;
    }

    const payload = this.form.getRawValue();

    if (payload.currentPassword === payload.newPassword) {
      this.error.set('El nuevo password debe ser diferente al actual.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.changePassword(payload).subscribe({
      next: (session) => {
        this.auth.setSession(session);
        void this.router.navigateByUrl('/app');
      },
      error: () => {
        this.error.set('No se pudo cambiar el password. Revisa el password actual.');
        this.loading.set(false);
      },
    });
  }
}
