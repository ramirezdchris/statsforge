import { Routes } from '@angular/router';
import { authGuard, guestGuard, passwordChangeGuard } from './core/guards/auth.guard';
import { ChangePasswordComponent } from './features/auth/change-password.component';
import { LoginComponent } from './features/auth/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: 'change-password',
    component: ChangePasswordComponent,
    canActivate: [passwordChangeGuard],
  },
  {
    path: 'app',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app',
  },
  {
    path: '**',
    redirectTo: 'app',
  },
];
