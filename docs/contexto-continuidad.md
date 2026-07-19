# Contexto de continuidad - StatsForge

Este archivo resume el estado actual del proyecto para retomar trabajo despues de cerrar terminales o sesiones.

## Proyecto

- Nombre: StatsForge
- Objetivo: sistema local de analisis estadistico deportivo con flujo de solicitudes.
- Stack actual:
  - Monorepo con pnpm workspaces.
  - Backend: NestJS.
  - Frontend: Angular 21.
  - Base local: Prisma + SQLite.

## Estado Git conocido

- Rama actual: `feat/sakai-layout`
- Ultimo commit base relevante:
  - `a40d5ef fase 1: conectar login y cambio obligatorio de password en Angular`

## Trabajo completado

### Fase 1 - Base

- Se creo `apps/api` con NestJS.
- Se creo `apps/web` con Angular.
- Se configuro pnpm workspaces.
- Se agrego Prisma con SQLite.
- Se creo schema inicial:
  - `User`
  - `Session`
  - `SystemConfig`
  - `AuditLog`
- Se agrego seed de admin inicial.

### Backend Auth/Users

- Endpoints agregados:
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `POST /auth/change-password`
  - `GET /users`
  - `POST /users/invite`
- Se agrego JWT con Passport.
- Se agrego guard de roles con `@Roles(...)`.
- Se agrego `@CurrentUser()`.
- Se agrego invitacion manual con password temporal.
- Se bloqueo el acceso normal cuando el JWT trae `scope: password-change-only`.
- Se agrego rate limit al login.

### Frontend Auth

- Se reemplazo el placeholder inicial de Angular.
- Se agrego `AuthService` con Angular signals:
  - `session`
  - `user`
  - `isAuthenticated`
  - `mustChangePassword`
- Se agrego persistencia de sesion en `localStorage`.
- Se agrego interceptor HTTP para enviar `Authorization: Bearer ...`.
- Se agregaron guards:
  - `authGuard`
  - `guestGuard`
  - `passwordChangeGuard`
- Se agregaron pantallas:
  - `/login`
  - `/change-password`
  - `/app`
- Se documento la verificacion en `docs/fase-1-verificacion.md`.

### Frontend Layout Sakai/PrimeNG

- Se creo la rama `feat/sakai-layout`.
- Se instalaron dependencias visuales en `apps/web`:
  - `primeng@21.1.9`
  - `@primeuix/themes`
  - `primeicons`
  - `primeflex`
  - `@angular/animations` alineado con Angular 21
- Se configuro PrimeNG con preset Aura en `app.config.ts`.
- Se agrego `primeicons.css` al build de Angular.
- Se adapto `/app` a un layout tipo admin inspirado en Sakai:
  - sidebar con marca y menu
  - topbar con usuario activo
  - metric cards de sesion/usuario/acceso
  - panel placeholder para gestion de usuarios
  - boton de logout usando PrimeNG Button
- Se mantuvieron intactos:
  - `AuthService`
  - guards
  - interceptor
  - rutas `/login`, `/change-password`, `/app`
  - flujo de cambio obligatorio de password

## Verificaciones realizadas

- `pnpm web:build`
- `pnpm web:test`
- Se levanto backend y frontend.
- Angular respondio en `http://127.0.0.1:4200/login`.
- Backend login respondio correctamente.
- El admin seed entro con `mustChangePassword: true`.
- En `feat/sakai-layout`:
  - `pnpm peers check`
  - `pnpm --filter web build`
  - `pnpm --filter web test`
- Nota: el build de `web` pasa, pero muestra warning de presupuesto inicial:
  - limite: `500 kB`
  - bundle actual: `540.97 kB`
  - exceso: `40.97 kB`

## Credenciales seed

- Email: `admin@statsforge.local`
- Password inicial: `cambiar-esto-al-primer-login`

## Decision sobre Sakai/PrimeNG

Se quiere aprender a implementar templates usando Sakai de PrimeNG.

Recomendacion tecnica:

- No reemplazar todo el frontend con Sakai completo.
- Integrar Sakai/PrimeNG de forma parcial.
- Mantener intactos:
  - `AuthService`
  - guards
  - interceptor
  - rutas `/login`, `/change-password`, `/app`
  - flujo de cambio obligatorio de password
- Usar Sakai principalmente como referencia para:
  - layout admin
  - sidebar
  - topbar
  - menu
  - estilos base
  - componentes PrimeNG utiles para tablas y formularios

## Siguiente paso recomendado

Conectar gestion de usuarios en Angular aprovechando el backend existente:

- Crear servicio frontend para `GET /users` y `POST /users/invite`.
- Reemplazar el placeholder de `/app` por tabla PrimeNG de usuarios.
- Agregar formulario/modal de invitacion para admins.
- Validar roles y estados visibles en la UI.
- Revisar si se aumenta el budget inicial de Angular o se reduce uso inicial de PrimeNG.

## Nota pendiente

Existe un archivo sin seguimiento llamado `docs/Fase 1`. Parece ser una nota/resumen de una terminal anterior. Antes de cerrar la fase, decidir si se elimina, se renombra a `.md`, o se integra en este documento.
