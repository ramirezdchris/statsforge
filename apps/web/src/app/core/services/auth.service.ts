import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthSession,
  ChangePasswordRequest,
  LoginRequest,
  UserRole,
} from '../models/auth.models';

const SESSION_KEY = 'statsforge.session';
const API_BASE_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<AuthSession | null>(this.readSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly user = computed(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.sessionSignal()));
  readonly mustChangePassword = computed(
    () => this.sessionSignal()?.mustChangePassword ?? false,
  );

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  login(payload: LoginRequest) {
    return this.http.post<AuthSession>(`${API_BASE_URL}/auth/login`, payload);
  }

  changePassword(payload: ChangePasswordRequest) {
    return this.http.post<AuthSession>(
      `${API_BASE_URL}/auth/change-password`,
      payload,
    );
  }

  logout() {
    const refreshToken = this.sessionSignal()?.refreshToken;

    if (refreshToken) {
      this.http
        .post(`${API_BASE_URL}/auth/logout`, { refreshToken })
        .subscribe({ error: () => undefined });
    }

    this.clearSession();
    void this.router.navigateByUrl('/login');
  }

  setSession(session: AuthSession) {
    this.sessionSignal.set(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  clearSession() {
    this.sessionSignal.set(null);
    localStorage.removeItem(SESSION_KEY);
  }

  hasRole(...roles: UserRole[]) {
    const role = this.sessionSignal()?.user.role;
    return Boolean(role && roles.includes(role));
  }

  private readSession(): AuthSession | null {
    const rawSession = localStorage.getItem(SESSION_KEY);

    if (!rawSession) {
      return null;
    }

    try {
      return JSON.parse(rawSession) as AuthSession;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
