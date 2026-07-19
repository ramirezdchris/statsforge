import { Routes } from '@angular/router';
import { authGuard, guestGuard, passwordChangeGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./features/auth/change-password.component').then((m) => m.ChangePasswordComponent),
    canActivate: [passwordChangeGuard],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'app',
        pathMatch: 'full',
        redirectTo: '/basket',
      },
      {
        path: 'explorer',
        loadComponent: () =>
          import('./features/explorer/explorer.component').then((m) => m.ExplorerComponent),
      },
      {
        path: 'basket',
        loadComponent: () =>
          import('./features/basket/basket.component').then((m) => m.BasketComponent),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./features/requests/requests.component').then((m) => m.RequestsComponent),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'basket',
      },
    ],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'basket',
  },
  {
    path: '**',
    redirectTo: 'basket',
  },
];
