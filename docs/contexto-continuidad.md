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
- Ultimo commit base antes de la tanda actual:
  - `b857c58 feat: integrar layout base Sakai`

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

### Frontend Administracion de usuarios

- Se agrego `UsersService` en Angular para consumir:
  - `GET /users`
  - `POST /users/invite`
  - `POST /users/:id/reset-password`
- Se reemplazo el placeholder de gestion de usuarios por una tabla PrimeNG.
- Se agrego modal de invitacion para admins.
- Se agrego accion de reset de password temporal.
- Se muestran rol, estado, ultimo acceso y bandera de cambio de password pendiente.

### Fase 2 inicial - Explorer, canasta y solicitudes

- Se agregaron modelos Prisma:
  - `League`
  - `Team`
  - `Market`
  - `ApiCache`
  - `AnalysisRequest`
- Se agregaron enums Prisma:
  - `RequestStatus`
  - `DeliveryChannel`
- Se agrego migracion `20260719012006_phase2_requests_explorer`.
- Se amplio el seed con mercados base:
  - goles, BTTS, corners, remates, tarjetas, tiempos, 1X2, forma, H2H y goleadores.
- Se agregaron modulos backend:
  - `football`
  - `markets`
  - `requests`
- Se agrego proxy/cache para API-Football usando `API_FOOTBALL_KEY` y `ApiCache`.
- Se agregaron endpoints protegidos:
  - `GET /football/leagues`
  - `GET /football/fixtures`
  - `GET /markets`
  - `GET /requests`
  - `POST /requests`
  - `POST /requests/:id/approve`
  - `POST /requests/:id/reject`
- Se agrego generacion inicial de JSON al aprobar solicitudes, calculada desde respuestas de API-Football.
- Se agregaron vistas Angular:
  - `/explorer`
  - `/basket`
  - `/requests`
- Se agrego `BasketService` con signals y persistencia local.
- Se agregaron servicios Angular para football, markets y solicitudes.
- Se ajusto el layout principal para que `/basket` sea la entrada operativa.

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

## Verificaciones pendientes de la tanda actual

- Ejecutar build/test backend despues de la migracion de Fase 2.
- Ejecutar build/test frontend despues de Explorer/Canasta/Solicitudes.
- Probar flujo manual con `API_FOOTBALL_KEY` real:
  - buscar liga
  - cargar proximos partidos
  - agregar a canasta
  - enviar solicitud
  - aprobar como ADMIN/ANALYST
  - descargar/copiar JSON generado
- Ejecutar `pnpm --filter api db:seed` despues de aplicar migraciones para cargar mercados.

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

Cerrar la Fase 2 inicial con verificacion real de flujo:

- Aplicar migraciones y seed en la base local.
- Configurar `API_FOOTBALL_KEY` en `.env`.
- Validar permisos por rol en `/requests`.
- Revisar el conteo real de llamadas API vs. `estimatedCalls`.
- Decidir si `approve` debe dejar estado intermedio `APPROVED` antes de `COMPLETED` o si la generacion sin cola queda aceptada por ahora.
- Implementar manejo visible de errores cuando API-Football no tenga cobertura para jugadores/estadisticas.
- Revisar si se aumenta el budget inicial de Angular o se reduce el uso inicial de PrimeNG/Tailwind.
- Definir siguiente bloque: favoritos/cache SQLite completo, Telegram o refinamiento del JSON.

## Nota pendiente

Existe un archivo sin seguimiento llamado `docs/Fase 1`. Es una nota/resumen de una terminal anterior e incluye credenciales/contraseñas escritas. No debe commitearse tal como esta; decidir si se elimina, se limpia y renombra a `.md`, o se integra parcialmente sin secretos.
