import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <main class="auth-shell">
      <section class="auth-panel">
        <p class="eyebrow">StatsForge</p>
        <h1>Ingreso</h1>
        <p class="lead">Accede al panel privado de analisis estadistico.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
          <label>
            Email
            <input
              type="email"
              formControlName="email"
              autocomplete="email"
              placeholder="admin@statsforge.local"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              formControlName="password"
              autocomplete="current-password"
              placeholder="Tu password"
            />
          </label>

          @if (error()) {
            <p class="form-error">{{ error() }}</p>
          }

          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Ingresando...' : 'Entrar' }}
          </button>
        </form>
      </section>
    </main>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit() {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (session) => {
        this.auth.setSession(session);
        void this.router.navigateByUrl(
          session.mustChangePassword ? '/change-password' : '/app',
        );
      },
      error: () => {
        this.error.set('Credenciales invalidas o usuario inactivo.');
        this.loading.set(false);
      },
    });
  }
}
