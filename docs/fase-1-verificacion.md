# Fase 1 - Verificacion de avance

Este documento registra que revisar despues de cada bloque importante.

## Bloque 1: scaffold + base Prisma

### Que se hizo

- Se creo `apps/api` con NestJS 11.
- Se creo `apps/web` con Angular 21.
- Se configuro pnpm workspaces para manejar ambas apps desde la raiz.
- Se agrego Prisma 7 con SQLite para la base local.
- Se creo el schema inicial de Fase 1:
  - `User`
  - `Session`
  - `SystemConfig`
  - `AuditLog`
- Se creo el seed del admin inicial y configuraciones base.

### Comandos para verificar

Desde la raiz del repo:

```bash
pnpm api:build
pnpm web:build
pnpm api:test
pnpm web:test
```

Para confirmar datos iniciales en SQLite:

```bash
cd apps/api
pnpm --filter api db:seed
```

### Que deberias ver

- `pnpm api:build` termina sin errores.
- `pnpm web:build` genera `apps/web/dist/web`.
- Tests del backend: `1 passed`.
- Tests del frontend: `2 passed`.
- El seed crea un admin con:
  - email desde `apps/api/.env`
  - rol `ADMIN`
  - `mustChangePassword: true`

### Archivos que no deben commitearse

- `node_modules/`
- `apps/api/prisma/dev.db`
- `apps/api/generated/`
- `apps/web/dist/`
