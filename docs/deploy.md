# Deploy de StatsForge

Ruta recomendada para la version actual:

- Backend NestJS en Railway usando `apps/api/Dockerfile`.
- Frontend Angular en Vercel usando `apps/web`.
- SQLite puede correr con un volumen persistente en Railway. Para uso serio futuro conviene migrar a Postgres.

## 1. Preparar backend en Railway

1. Crear un proyecto en Railway.
2. Crear un servicio desde el repositorio.
3. Configurar el servicio para usar el Dockerfile:
   - Root directory: raiz del repositorio
   - Dockerfile path: `apps/api/Dockerfile`
4. Agregar variables en Railway:

```env
DATABASE_URL="file:/data/statsforge.db"
JWT_SECRET="genera-un-secret-largo"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"
ADMIN_EMAIL="tu-correo@dominio.com"
ADMIN_PASSWORD="password-temporal-fuerte"
ADMIN_NAME="Admin"
# Opcional: usar "true" temporalmente para resetear el password del admin existente.
ADMIN_RESET_PASSWORD_ON_SEED="false"
API_FOOTBALL_KEY="tu-api-key"
API_FOOTBALL_HOST="v3.football.api-sports.io"
API_FOOTBALL_BASE_URL="https://v3.football.api-sports.io"
NODE_ENV="production"
CORS_ORIGIN="https://tu-web.vercel.app"
```

5. Agregar un volumen persistente montado en `/data`.
6. Deployar el servicio.
7. Abrir la URL publica del backend y verificar que responda:

```text
{"name":"StatsForge API","status":"ok"}
```

## 2. Preparar frontend en Vercel

1. Crear proyecto en Vercel desde el mismo repositorio.
2. Configurar:
   - Framework preset: Angular
   - Root directory: `apps/web`
   - Install command: `pnpm install --frozen-lockfile`
   - Build command: `pnpm build:deploy`
   - Output directory: `dist/web/browser`
3. Agregar variable de entorno:

```env
WEB_API_BASE_URL="https://tu-backend-production.up.railway.app"
```

4. Deployar.
5. Cuando Vercel entregue la URL final, volver a Railway y actualizar:

```env
CORS_ORIGIN="https://tu-web.vercel.app"
```

6. Redeployar backend.

## 3. Prueba final

1. Abrir la URL de Vercel.
2. Login con el admin inicial configurado en Railway.
3. Cambiar password obligatorio.
4. Entrar a Canasta, Explorer y Solicitudes.
5. Probar una solicitud con `API_FOOTBALL_KEY` real.

## Notas

- No subas `apps/api/.env`.
- No commitees `docs/Fase 1` sin limpiarlo porque contiene credenciales.
- Si el frontend carga pero el login falla, casi siempre es `WEB_API_BASE_URL` incorrecto o `CORS_ORIGIN` sin la URL exacta de Vercel.
- Si olvidaste el password del admin en Railway, pon `ADMIN_PASSWORD` con un temporal nuevo y `ADMIN_RESET_PASSWORD_ON_SEED="true"`, redeploya el backend, entra con ese password y despues vuelve a dejar `ADMIN_RESET_PASSWORD_ON_SEED="false"`.
