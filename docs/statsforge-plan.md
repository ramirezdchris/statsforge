# StatsForge — Plan maestro del proyecto

> Sistema local de análisis estadístico deportivo para apuestas, con flujo de solicitudes multi-usuario y aprobación por rol.
>
> **Estado:** planificación completa, listo para arrancar Fase 1.
> **Última actualización del documento:** 15 jul 2026.

---

## Tabla de contenido

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Roles y permisos](#3-roles-y-permisos)
4. [Flujo de usuario](#4-flujo-de-usuario)
5. [Arquitectura](#5-arquitectura)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Gestión de usuarios y autenticación](#7-gestión-de-usuarios-y-autenticación)
8. [Caché y ahorro de cuota](#8-caché-y-ahorro-de-cuota)
9. [CRON jobs automatizados](#9-cron-jobs-automatizados)
10. [Diseño visual](#10-diseño-visual)
11. [Fases de desarrollo](#11-fases-de-desarrollo)
12. [Estructura de carpetas](#12-estructura-de-carpetas)
13. [Costos y despliegue](#13-costos-y-despliegue)
14. [Decisiones tomadas](#14-decisiones-tomadas)
15. [Cosas pendientes de definir](#15-cosas-pendientes-de-definir)
16. [Comandos de referencia](#16-comandos-de-referencia)

---

## 1. Visión general

### Propósito

StatsForge es una aplicación web privada que permite analizar partidos de fútbol de las principales ligas europeas para generar **JSON estadísticos** que se usan como insumo para análisis de apuestas. El sistema:

- Consume datos reales desde **API-Football** (sin números inventados por IA)
- Permite armar canastas multi-liga con partidos y mercados específicos
- Tiene un **flujo de aprobación de solicitudes** que controla el gasto de cuota API
- Puede entregar los JSON por app y por Telegram
- Cachea agresivamente para minimizar llamadas repetidas a la API

### Principios no negociables

1. **Cero números inventados o generados por LLM.** Toda estadística viene de API-Football y se calcula con código determinista.
2. **Control total del ADMIN sobre el gasto de cuota.** Ninguna llamada a la API sin aprobación explícita.
3. **Datos bajo control propio.** SQLite local, cero dependencias de servicios externos de auth o storage.
4. **Progresivamente offline-first.** Con el tiempo, la mayoría de solicitudes se resuelven desde caché sin tocar la API.

---

## 2. Stack tecnológico

### Backend

| Componente | Tecnología | Versión objetivo |
|---|---|---|
| Runtime | Node.js LTS | 22.x |
| Framework | NestJS | 11.x |
| ORM | Prisma | 7.x |
| Base de datos | SQLite (dev y prod inicial) | 3.x |
| Caché en memoria | Redis (desde Fase 5) | 7.x |
| Colas de trabajo | Bull (`@nestjs/bull`) | 10.x |
| Auth | JWT + Passport (`@nestjs/passport`) | 10.x |
| Scheduler | `@nestjs/schedule` | 4.x |
| Validación | `class-validator` + `class-transformer` | latest |
| HTTP externo | `@nestjs/axios` | 3.x |
| Bot Telegram | `telegraf` (Fase 4) | 4.x |

### Frontend

| Componente | Tecnología | Versión objetivo |
|---|---|---|
| Framework | Angular | 21.x |
| Arquitectura | Standalone components + Signals | — |
| UI kit | PrimeNG | 21.x |
| CSS utility | Tailwind CSS | 4.x |
| Iconos | Lucide Angular + PrimeIcons | latest |
| Utilidades base | `@angular/cdk` | 21.x |
| Estado | Angular Signals + `NgRx signals` (opcional en Fase 5) | — |

### Herramientas dev

- **Gestor paquetes:** pnpm 9
- **Monorepo:** estructura simple con `apps/api` y `apps/web`
- **Git** para versionado
- **Docker Compose** (opcional desde Fase 5)

### Fuente de datos externa

- **API-Football** vía RapidAPI o sitio oficial
  - Plan gratis: 100 requests/día, temporadas antiguas
  - Plan Pro ($19/mes): temporadas actuales, mayor límite
  - Devuelve URLs de logos de ligas y equipos en cada respuesta

---

## 3. Roles y permisos

### Tres niveles jerárquicos

**ADMIN**
- Todo lo que puede hacer ANALYST
- Gestiona usuarios (invitar, cambiar rol, desactivar, resetear password)
- Edita `SystemConfig` (nombre app, thresholds, defaults)
- Ve logs de auditoría completos
- Configura ligas custom base del sistema
- Ve el panel de caché completo con métricas de espacio y cuota

**ANALYST**
- Todo lo que puede hacer VIEWER
- **Aprueba o rechaza solicitudes** de VIEWERs (dispara consumo de API)
- Genera análisis directamente (sin pasar por solicitud) para uso propio
- Ve la Bandeja de solicitudes
- Ve favoritos globales, marca los suyos

**VIEWER**
- Explora ligas y partidos (Explorer)
- Arma canasta multi-liga con partidos y mercados
- **Envía solicitudes** de análisis (no genera directamente)
- Ve su historial de solicitudes con estados
- Configura sus favoritos personales y su Telegram
- No ve panel admin, no ve otras solicitudes, no ve usuarios

### Matriz rápida de permisos

| Acción | ADMIN | ANALYST | VIEWER |
|---|:-:|:-:|:-:|
| Login | ✓ | ✓ | ✓ |
| Explorar ligas y partidos | ✓ | ✓ | ✓ |
| Armar canasta | ✓ | ✓ | ✓ |
| Marcar favoritos personales | ✓ | ✓ | ✓ |
| Configurar Telegram propio | ✓ | ✓ | ✓ |
| Generar JSON directamente | ✓ | ✓ | ✗ |
| Enviar solicitud de análisis | ✓ | ✓ | ✓ |
| Ver solicitudes propias | ✓ | ✓ | ✓ |
| Ver bandeja de solicitudes de todos | ✓ | ✓ | ✗ |
| Aprobar/rechazar solicitudes | ✓ | ✓ | ✗ |
| Invitar usuarios | ✓ | ✗ | ✗ |
| Cambiar roles | ✓ | ✗ | ✗ |
| Editar SystemConfig | ✓ | ✗ | ✗ |
| Ver logs de auditoría | ✓ | parcial | ✗ |
| Vaciar caché forzado | ✓ | ✗ | ✗ |

---

## 4. Flujo de usuario

### Flujo directo (ADMIN / ANALYST)

1. Login
2. **Explorer**: multi-check de ligas → lista de partidos próximos → añadir a canasta
3. **Canasta**: revisar selecciones agrupadas por liga
4. Marcar **mercados** (aplican a todos los partidos)
5. Configurar histórico (últimos N partidos) y toggle Excel
6. Click **"Generar JSON"** → API se llama (si hace falta) → descarga

### Flujo con aprobación (VIEWER)

1. VIEWER inicia sesión
2. Explora ligas y arma canasta (idéntico al flujo directo)
3. Marca mercados y configuración
4. Elige **canal de entrega**: app / Telegram / ambos
5. Opcional: agrega un mensaje al ADMIN
6. Click **"Enviar solicitud"** → queda en estado `PENDIENTE`
7. Recibe notificación cuando su solicitud es aprobada/rechazada
8. Si aprobada: descarga el JSON en su vista "Mis solicitudes" o lo recibe en Telegram

### Flujo de aprobación (ADMIN / ANALYST)

1. Notificación in-app (badge en sidebar) + opcional Telegram
2. Abre **Bandeja de solicitudes**
3. Ve el detalle: quién pidió, qué pidió, cuánta cuota API gasta (estimación)
4. Decide:
   - **Aprobar** → sistema llama a API-Football si es necesario → genera JSON → entrega por canal elegido
   - **Rechazar** → con motivo opcional → notifica al VIEWER
5. Ve historial de aprobaciones/rechazos

### Regla clave: cuándo se gasta cuota API

**La API se llama solo al aprobar la solicitud, y solo para partidos que no están en caché.**

Ejemplo real:
- María Paz pide análisis de Juventus-Inter y Barcelona-Sevilla
- Ambos partidos son del próximo sábado
- El CRON diario ya precargó todos los partidos de las próximas 72h de sus ligas favoritas
- Cuando el ADMIN aprueba → **0 llamadas a API**, JSON generado en < 2 segundos desde SQLite

---

## 5. Arquitectura

### Diagrama de componentes

```
┌─────────────────────────────────────────────────────────┐
│                    NAVEGADOR                            │
│   ┌───────────────────────────────────────────────┐    │
│   │  Angular 21 + PrimeNG + Tailwind              │    │
│   │  Signals, Standalone, Guards, hasRole()       │    │
│   └───────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND NestJS                       │
│  ┌───────────┬──────────┬─────────┬────────┬─────────┐ │
│  │   auth    │  users   │ leagues │ teams  │matches  │ │
│  ├───────────┼──────────┼─────────┼────────┼─────────┤ │
│  │ requests  │ markets  │  cache  │ config │notific. │ │
│  └───────────┴──────────┴─────────┴────────┴─────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Interceptors · Guards · Filters · Pipes          │ │
│  └───────────────────────────────────────────────────┘ │
└─────┬────────────┬──────────────┬───────────┬──────────┘
      │            │              │           │
      ▼            ▼              ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────┐
│  SQLite  │ │  Redis   │ │ API-Football │ │Telegram │
│ + Prisma │ │ (fase 5) │ │  (externo)   │ │  Bot    │
└──────────┘ └──────────┘ └──────────────┘ └─────────┘
```

### Módulos backend

- **`auth`** — login, refresh, logout, cambio de password
- **`users`** — CRUD de usuarios, invitaciones (solo ADMIN)
- **`leagues`** — ligas base + custom del sistema
- **`teams`** — equipos por liga
- **`matches`** — partidos, fixtures, head-to-head, estadísticas
- **`markets`** — catálogo de mercados disponibles (goles, córners, tarjetas, etc.)
- **`requests`** — solicitudes de análisis con workflow de aprobación
- **`cache`** — gestión de caché SQLite + Redis (métricas, vaciado forzado)
- **`config`** — `SystemConfig` (nombre app, thresholds, defaults)
- **`notifications`** — in-app + Telegram (Fase 4)

### Flujo interno de una solicitud aprobada

1. `RequestsController.approve(id)` → verifica rol ANALYST o ADMIN
2. `RequestsService.approve(id)`:
   a. Cambia estado a `APROBADA`
   b. Encola job en Bull: `generate-analysis`
3. Worker de Bull:
   a. Por cada partido en la canasta:
      - ¿Existe en SQLite? → usa esos datos
      - ¿No existe? → llama a API-Football → guarda en SQLite → usa esos datos
   b. Calcula estadísticas de los mercados solicitados
   c. Arma el JSON final
   d. Estado → `COMPLETADA`
   e. Dispara notificación (in-app + Telegram si aplica)

---

## 6. Modelo de datos

### Schema Prisma (versión inicial Fase 1)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  ANALYST
  VIEWER
}

enum RequestStatus {
  PENDIENTE
  APROBADA
  COMPLETADA
  RECHAZADA
  FALLIDA
}

enum DeliveryChannel {
  APP
  TELEGRAM
  BOTH
}

enum FavoriteType {
  LEAGUE
  TEAM
}

model User {
  id                   String    @id @default(cuid())
  email                String    @unique
  passwordHash         String
  name                 String
  role                 Role      @default(VIEWER)
  isActive             Boolean   @default(true)
  mustChangePassword   Boolean   @default(false)
  passwordChangedAt    DateTime?
  telegramChatId       String?
  telegramUsername     String?
  invitedById          String?
  invitedAt            DateTime?
  lastLoginAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  invitedBy            User?     @relation("Invitations", fields: [invitedById], references: [id])
  invitations          User[]    @relation("Invitations")
  sessions             Session[]
  favorites            Favorite[]
  requests             AnalysisRequest[] @relation("Requester")
  approvedRequests     AnalysisRequest[] @relation("Approver")
  auditLogs            AuditLog[]
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  refreshToken String   @unique
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SystemConfig {
  key       String   @id
  value     String
  category  String   @default("general")
  updatedAt DateTime @updatedAt
}

model League {
  id            Int      @id
  name          String
  country       String
  logoUrl       String?
  logoLocal     String?
  flagUrl       String?
  isBase        Boolean  @default(false)
  isEnabled     Boolean  @default(true)
  createdAt     DateTime @default(now())
  teams         Team[]
  matches       Match[]
}

model Team {
  id            Int      @id
  leagueId      Int
  name          String
  code          String?
  logoUrl       String?
  logoLocal     String?
  createdAt     DateTime @default(now())
  league        League   @relation(fields: [leagueId], references: [id])
  homeMatches   Match[]  @relation("HomeTeam")
  awayMatches   Match[]  @relation("AwayTeam")
}

model Match {
  id            Int       @id
  leagueId      Int
  season        Int
  homeTeamId    Int
  awayTeamId    Int
  date          DateTime
  status        String
  homeScore     Int?
  awayScore     Int?
  htHomeScore   Int?
  htAwayScore   Int?
  rawStatsJson  String?
  fetchedAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  league        League    @relation(fields: [leagueId], references: [id])
  homeTeam      Team      @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeam      Team      @relation("AwayTeam", fields: [awayTeamId], references: [id])

  @@index([date])
  @@index([leagueId, season])
}

model Favorite {
  id         String       @id @default(cuid())
  userId     String
  type       FavoriteType
  targetId   Int
  createdAt  DateTime     @default(now())
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type, targetId])
}

model AnalysisRequest {
  id              String          @id @default(cuid())
  requesterId     String
  approverId      String?
  status          RequestStatus   @default(PENDIENTE)
  message         String?
  rejectionReason String?
  basketJson      String
  marketsJson     String
  historyDepth    Int             @default(10)
  includeExcel    Boolean         @default(false)
  deliveryChannel DeliveryChannel @default(APP)
  estimatedCalls  Int?
  actualCalls     Int?
  resultJson      String?
  resultExcelPath String?
  createdAt       DateTime        @default(now())
  processedAt     DateTime?
  deliveredAt     DateTime?

  requester       User            @relation("Requester", fields: [requesterId], references: [id])
  approver        User?           @relation("Approver", fields: [approverId], references: [id])

  @@index([status])
  @@index([requesterId])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  metadata  String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([action])
}
```

### Tablas que se agregan por fase

- **Fase 1:** `User`, `Session`, `SystemConfig`, `AuditLog` + tablas base de dominio con seed
- **Fase 2:** `AnalysisRequest`
- **Fase 3:** `Favorite`, `League`, `Team`, `Match` completas
- **Fase 5:** ninguna nueva; Redis para caché volátil

---

## 7. Gestión de usuarios y autenticación

### Almacenamiento

Todo en SQLite local: `User`, `Session`, `AuditLog`. Cero servicios externos (Auth0, Firebase, Cognito).

### Passwords

- Hasheados con **bcrypt** (cost factor 10)
- Nunca se almacena ni se registra el password plano
- Validación mínima: 8 caracteres, no puede ser igual al temporal
- Password temporal generado con alfabeto legible (sin caracteres confusos O/0, I/1/l): `Kx9y-tRp2-Mn4v`

### Autenticación

- **JWT access token** firmado con secret del `.env`, expira en **15 minutos**
- **Refresh token** de **7 días**, hasheado y guardado en `Session`
- Header estándar: `Authorization: Bearer <token>`
- **Refresh rotation**: cada uso invalida el anterior

### Autorización

- Decorador `@Roles('ADMIN', 'ANALYST')` en cada endpoint del backend
- `RolesGuard` intercepta y compara con el JWT
- Frontend: directiva `*hasRole="'ADMIN'"` para esconder botones (solo UX, seguridad real en backend)

### Flujo de invitación (Fase 1)

1. ADMIN abre "Ajustes → Usuarios" → **"+ Invitar usuario"**
2. Ingresa email + nombre + rol (ANALYST o VIEWER)
3. Sistema:
   - Crea `User` con `mustChangePassword: true`
   - Genera password temporal legible
   - Registra `invitedById` para auditoría
4. Se muestra **tarjeta única** con las credenciales (solo una vez):
   ```
   Email:    mariapaz@gmail.com
   Password: Kx9y-tRp2-Mn4v
   ```
5. ADMIN copia y entrega **manualmente** por WhatsApp, Telegram o el canal que prefiera
6. En Fase 4, cuando exista el bot de Telegram, esto se automatiza opcionalmente

### Flujo de primer login del invitado

1. Ingresa email + password temporal
2. Backend detecta `mustChangePassword: true`
3. JWT emitido tiene claim especial `scope: 'password-change-only'`
4. Middleware bloquea toda ruta excepto `POST /auth/change-password`
5. Usuario cambia su password → `mustChangePassword: false` → JWT normal emitido
6. Redirección al Dashboard según rol

### Cambios posteriores de password

- Usuario cualquiera: vista "Mi perfil" → "Cambiar contraseña" (pide password actual)
- ADMIN puede "Resetear password" de cualquiera (genera nuevo temporal, marca `mustChangePassword: true`)

### Seguridad práctica

- **Rate limit login**: máximo 5 intentos por minuto por IP (`@nestjs/throttler`)
- **Logout real**: borra `Session` del backend
- **Audit log**: registra LOGIN, LOGOUT, CHANGE_ROLE, INVITE_USER, APPROVE_REQUEST, REJECT_REQUEST, PASSWORD_RESET
- **Admin bootstrap**: al correr seed, si no existe ADMIN, se crea con credenciales del `.env`

---

## 8. Caché y ahorro de cuota

### Filosofía

El plan gratis de API-Football es **100 requests/día**. Sin caché, un análisis medio puede consumir **25 llamadas**, permitiendo solo 4 análisis diarios. Con caché bien hecha, los mismos partidos consultados varias veces cuestan **0 llamadas** a partir de la segunda vez.

### Estrategia en capas

**Capa 1 — Redis (Fase 5)**
- TTL corto (5-60 minutos) para datos volátiles como fixtures próximos
- TTL largo (24h) para datos estables como resultados ya jugados
- Uso: respuestas rápidas a queries repetidas dentro de una sesión

**Capa 2 — SQLite (Fase 3 y adelante)**
- Partidos ya jugados: **caché permanente**, nunca vencen (los datos son inmutables)
- Fixtures próximos: se actualizan según regla del CRON
- Tablas `Match` y `MatchStatistics` acumulan todo el histórico consultado

**Capa 3 — API-Football**
- Solo se llama cuando ninguna de las anteriores tiene el dato
- Cada respuesta se guarda inmediatamente en SQLite

### Flujo de resolución de un partido

```
Petición → ¿Está en Redis?
             ├── Sí → devolver
             └── No → ¿Está en SQLite?
                       ├── Sí → guardar en Redis + devolver
                       └── No → llamar API-Football
                                → guardar en SQLite
                                → guardar en Redis
                                → devolver
```

### Panel de caché (solo ADMIN)

- Tamaño total del `dev.db`
- Cantidad de partidos cacheados por liga
- Últimas 20 llamadas a la API con timestamp y consumo
- **Botón "Vaciar caché forzado"**: elimina Redis + marca todos los `Match` como no vigentes (los próximos se re-descargan; los ya jugados quedan)

---

## 9. CRON jobs automatizados

Todos con `@nestjs/schedule`. Se activan en Fase 5.

### Diario 03:00 UTC — Precarga de favoritos

**Objetivo:** cuando los usuarios abren la app, todo está listo sin llamadas en vivo.

Recorre todos los usuarios activos, junta sus ligas favoritas, y precarga:
- Fixtures de las próximas 72 horas
- Estadísticas de los últimos 10 partidos de cada equipo favorito
- Head-to-head recientes entre equipos favoritos

### Cada 6h — Refresco de resultados

**Objetivo:** capturar correcciones oficiales de tarjetas, goles, córners.

Refresca partidos jugados en las últimas 24 horas. Estos datos a veces se ajustan por decisiones de la disciplinaria.

### Domingo 04:00 UTC — Limpieza semanal

- Elimina de Redis lo que ya está en SQLite (redundancia)
- Compacta la base SQLite con `VACUUM`
- Reporte in-app al ADMIN: "Se liberaron X MB, se procesaron Y partidos"

### Mensual día 1, 04:00 UTC — Snapshot

- Exporta un JSON completo con la temporada de las ligas favoritas
- Guarda en `apps/api/storage/snapshots/`
- Backup automático por si algún día se corrompe la base

### `OnApplicationBootstrap` — Health check al arranque

- Verifica que API-Football responde
- Muestra cuota disponible del día
- Verifica conexión con Redis
- Verifica integridad de SQLite

Si algo falla, log de error visible en la vista "Ajustes → Sistema".

---

## 10. Diseño visual

### Concepto

**Panel de control tipo consola de operador.** No es un dashboard fan-facing sino una herramienta de trabajo para quien controla la máquina.

### Paleta

| Nombre | Hex | Uso |
|---|---|---|
| Background | `#0A0E1A` | fondo base |
| Panel | `#131A2C` | cards y contenedores |
| Panel Alt | `#1A2340` | contenedores anidados |
| Panel Hi | `#202B4A` | estados hover/activo |
| Border | `#2A3454` | separadores default |
| Border Hi | `#3D4B75` | separadores destacados |
| Text | `#E5EBF5` | texto principal |
| Text Dim | `#7A87A8` | texto secundario |
| Text Dimmer | `#4D5878` | labels, timestamps |
| **Lime** (acción) | `#A3E635` | botón Generar, éxito |
| **Amber** (favorito/warn) | `#F59E0B` | estrellas, warnings |
| **Sky** (info/telegram) | `#38BDF8` | info, iconos telegram |
| **Rose** (peligro) | `#F43F5E` | rechazar, error |

### Tipografía

- **Display: Archivo** — 800/900, tracking cerrado. Uso: h1, títulos de sección, nombres de equipos.
- **Body: Inter** — 400/500/600. Uso: párrafos, labels, botones.
- **Mono: JetBrains Mono** — 500/600. Uso: JSON preview, IDs, timestamps, códigos de país (`ESP · id 140`).

### Elementos signature

1. **Rail derecho de "preview en vivo"** — la estimación de llamadas API y la estructura del JSON se actualizan mientras marcas opciones. Es el elemento diferenciador frente a un dashboard genérico.
2. **Numeración de pasos con eyebrow monospace** — `01`, `02`, `03` estilo consola.
3. **Chips de liga con logos gradiente** — cuando no hay logo real, gradientes que evocan la bandera del país.
4. **Botón principal en lima con glow sutil** — la acción de generar destaca por color y sombra, no por tamaño.

### Restricciones

- **Los mockups son de escritorio.** Responsive se maneja con Tailwind:
  - Móvil (< 768px): sidebar colapsable con hamburguesa, rail oculta, grids de 1 columna
  - Tablet (768-1200px): sidebar visible, rail oculta, grids de 2 columnas
  - Desktop (> 1200px): layout completo

### Mockups entregados

Los tres mockups HTML validados están en:
- `mockup-generador.html` — flujo directo (ADMIN/ANALYST)
- `mockup-canasta.html` — canasta multi-liga
- `mockup-bandeja.html` — bandeja de aprobación de solicitudes

Los mockups reflejan la dirección visual final que Angular + PrimeNG + Tailwind reproducirán.

---

## 11. Fases de desarrollo

### Fase 1 — Fundamentos + Auth (semanas 1-2)

**Backend:**
- Setup Nest, Prisma, SQLite
- Módulos: `auth`, `users`, `config`
- Modelos: `User`, `Session`, `SystemConfig`, `AuditLog`
- Endpoints: login, refresh, logout, change-password, invite
- Seed: 1 admin + config default
- `@Roles()` guard + audit interceptor

**Frontend:**
- Setup Angular 21 + PrimeNG + Tailwind
- Tema custom con tokens del mockup
- AuthService (signals) + AuthGuard + RoleGuard + directiva `*hasRole`
- Login screen
- Change password forzado
- Layout con sidebar condicionada
- Vista Ajustes → Usuarios (CRUD + invitar)
- Vista Ajustes → Sistema (editar `SystemConfig`)

**Entregable:** login funciona, roles ven distinto sidebar, ADMIN puede invitar usuarios y renombrar la app desde ajustes.

### Fase 2 — Solicitudes y aprobación (semana 3)

**Backend:**
- Módulos: `leagues`, `teams`, `matches`, `markets`, `requests`
- Modelo: `AnalysisRequest`
- Endpoints:
  - `POST /requests` (crear solicitud)
  - `GET /requests` (lista según rol)
  - `POST /requests/:id/approve` (ADMIN/ANALYST)
  - `POST /requests/:id/reject`
- Proxy a API-Football con caché en memoria simple
- Cálculo de estadísticas por mercado

**Frontend:**
- Vista Explorer (multi-select ligas + lista partidos + añadir a canasta)
- Vista Canasta (agrupada por liga, mercados, config, botón generar/enviar)
- Vista Bandeja de solicitudes (ADMIN/ANALYST) con aprobar/rechazar
- Vista Mis solicitudes (VIEWER)
- Servicio de canasta con Signals + persistencia en localStorage

**Entregable:** flujo end-to-end completo. VIEWER envía solicitudes, ADMIN aprueba, JSON se genera y descarga.

### Fase 3 — Persistencia completa + caché SQLite (semana 4)

**Backend:**
- Modelo completo: `League`, `Team`, `Match`, `Favorite`
- Cada partido consultado → guardado en SQLite forever
- Descarga y cacheado local de logos en `storage/logos/`
- Panel de caché real con métricas
- Favoritos server-side (ligas + equipos por usuario)

**Frontend:**
- Componente `<app-crest>` con fallback a placeholder por iniciales
- Vista Caché con métricas y botón vaciar forzado
- Estrellas de favorito en Explorer y Canasta

**Entregable:** cada consulta enriquece la base local. Al día 30, la mayoría de solicitudes ni tocan API.

### Fase 4 — Telegram + notificaciones (semana 5)

**Preparación (guiada paso a paso):**
- Crear bot con **@BotFather** en Telegram (proceso 4 mensajes)
- Copiar token del bot al `.env`
- Configurar webhook

**Backend:**
- Módulo `notifications` con `TelegramService` (`telegraf`)
- Endpoint para que cada usuario vincule su `chat_id` (le habla al bot con un código)
- Al aprobar solicitud → si canal es TELEGRAM/BOTH → envía JSON como archivo
- Al llegar nueva solicitud → notifica ADMIN por Telegram
- Notificaciones in-app con badge

**Frontend:**
- Vista Perfil → Configurar Telegram (código + instrucciones)
- Selector de canal de entrega en Canasta
- Badge de notificaciones en sidebar

**Entregable:** entrega automática por Telegram funcionando.

### Fase 5 — Redis + colas + CRON (semana 6)

**Backend:**
- Redis con `CacheModule` (Upstash gratis o Docker local)
- Bull queue para procesar aprobaciones grandes
- WebSocket con `@nestjs/websockets` para progreso en vivo
- Todos los CRON jobs de la sección 9

**Frontend:**
- Barra de progreso en vivo cuando ADMIN aprueba (WebSocket)
- Panel de stats de CRON en Ajustes → Sistema

**Entregable:** sistema automatizado que trabaja mientras duermes.

### Fase 6 — Nivel pro (semana 7+)

- Swagger auto-generado (`@nestjs/swagger`)
- Panel admin de usuarios completo (invitar, cambiar rol, desactivar, ver actividad)
- `Dockerfile` + `docker-compose.yml` con todo el stack
- Tests con Jest (mínimo 60% en servicios críticos)
- Deploy: Angular → Vercel, Nest + SQLite + Redis → Railway con volumen persistente
- Migración opcional SQLite → Postgres

---

## 12. Estructura de carpetas

```
statsforge/
├── .env.example
├── .gitignore
├── docker-compose.yml         (Fase 5+)
├── README.md
├── package.json               (root, workspaces)
├── pnpm-workspace.yaml
│
├── apps/
│   ├── api/                   Backend NestJS
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── config/
│   │   │   ├── leagues/
│   │   │   ├── teams/
│   │   │   ├── matches/
│   │   │   ├── markets/
│   │   │   ├── requests/
│   │   │   ├── cache/
│   │   │   ├── notifications/
│   │   │   ├── common/
│   │   │   │   ├── decorators/    (@Roles, @CurrentUser)
│   │   │   │   ├── guards/        (JwtGuard, RolesGuard)
│   │   │   │   ├── filters/       (exception filter global)
│   │   │   │   ├── interceptors/  (logging, audit)
│   │   │   │   └── pipes/
│   │   │   ├── prisma/            (PrismaService)
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   ├── migrations/
│   │   │   └── dev.db             (gitignored)
│   │   ├── storage/               (gitignored)
│   │   │   ├── logos/
│   │   │   │   ├── leagues/
│   │   │   │   └── teams/
│   │   │   └── snapshots/
│   │   └── .env
│   │
│   └── web/                   Frontend Angular
│       ├── src/
│       │   ├── app/
│       │   │   ├── core/
│       │   │   │   ├── services/       (AuthService, ApiService)
│       │   │   │   ├── guards/
│       │   │   │   ├── interceptors/   (auth, error, loading)
│       │   │   │   └── directives/     (hasRole)
│       │   │   ├── shared/
│       │   │   │   ├── components/     (crest, league-logo, status-pill)
│       │   │   │   ├── pipes/
│       │   │   │   └── layouts/        (main-layout, auth-layout)
│       │   │   ├── features/
│       │   │   │   ├── auth/           (login, change-password)
│       │   │   │   ├── dashboard/
│       │   │   │   ├── explorer/
│       │   │   │   ├── basket/         (canasta)
│       │   │   │   ├── requests/       (bandeja + mis solicitudes)
│       │   │   │   ├── favorites/
│       │   │   │   ├── admin/          (usuarios, ligas, config)
│       │   │   │   └── cache-panel/
│       │   │   ├── models/             (TypeScript interfaces)
│       │   │   ├── app.config.ts
│       │   │   ├── app.routes.ts
│       │   │   └── app.component.ts
│       │   ├── assets/
│       │   ├── styles/
│       │   │   ├── tokens.css          (variables del mockup)
│       │   │   └── tailwind.css
│       │   └── main.ts
│       ├── tailwind.config.js
│       └── angular.json
│
└── docs/
    ├── plan.md                (este documento)
    ├── mockup-generador.html
    ├── mockup-canasta.html
    └── mockup-bandeja.html
```

---

## 13. Costos y despliegue

### Desarrollo local (todas las fases)

**$0** — todo corre en tu máquina Ubuntu.

### Producción en la nube

| Servicio | Uso | Costo |
|---|---|---|
| Vercel | Angular estático | $0 (free tier) |
| Railway | NestJS + SQLite + Redis (volumen persistente) | $0-5/mes |
| Upstash Redis | Alternativa a Redis en Railway | $0 (10k comandos/día) |
| API-Football gratis | Temporadas antiguas para testing | $0 |
| **API-Football Pro** | **Temporadas actuales (obligatorio para uso real)** | **$19/mes** |
| Dominio propio | Opcional | $10-15/año |

**Total mínimo real:** $19/mes (solo API Pro).
**Todo lo demás gratis** en escala personal.

### Piezas obligatorias vs opcionales

- **Obligatorio:** Vercel + Railway + API Pro
- **Opcional Fase 5:** Upstash Redis si no quieres correr Redis en Railway
- **Opcional Fase 6:** Dominio, Postgres, CDN

---

## 14. Decisiones tomadas

1. ✅ **Stack:** NestJS + Prisma + SQLite / Angular 21 + PrimeNG + Tailwind
2. ✅ **Roles:** ADMIN, ANALYST, VIEWER (tres niveles)
3. ✅ **Flujo VIEWER:** envía solicitudes, no genera directo
4. ✅ **Aprobación:** ANALYST y ADMIN pueden aprobar/rechazar
5. ✅ **Momento de llamada API:** solo al aprobar (para no gastar cuota si se rechaza)
6. ✅ **Nombre del proyecto:** placeholder "StatsForge", cambiable desde `SystemConfig` sin redeploy
7. ✅ **SO desarrollo:** Ubuntu Linux
8. ✅ **Package manager:** pnpm
9. ✅ **Base de datos:** SQLite en dev y prod inicial (Postgres opcional futuro)
10. ✅ **Auth:** JWT + refresh, todo en SQLite local, cero servicios externos
11. ✅ **Entrega inicial de credenciales:** manual (copia/pega), Telegram automático en Fase 4
12. ✅ **Telegram:** bot con @BotFather en Fase 4
13. ✅ **CRON:** completo, con precarga de favoritos, refresco 6h, limpieza semanal, snapshot mensual
14. ✅ **Caché:** SQLite permanente para históricos, Redis TTL corto para volátil
15. ✅ **Logos:** URL de API-Football → descarga + cache local en `storage/logos/`
16. ✅ **Responsive:** Tailwind con breakpoints 768/1200
17. ✅ **Fases:** 6 fases planificadas, ~7 semanas totales

---

## 15. Cosas pendientes de definir

- ⏳ **Nombre real del proyecto** — actualmente "StatsForge" como placeholder. Ideas descartables: MatchLab, ScoutForge, Oráculo, Ficha, Kickstats, GolIQ, Táctico.
- ⏳ **Lista completa de mercados** — el usuario los definirá gradualmente. Los conocidos por ahora: goles totales, over/under 2.5, ambos marcan (BTTS), córners, tiros a puerta, posesión, tarjetas amarillas, tarjetas rojas, goles por tiempo, marcador 1T, marcador 2T.
- ⏳ **Ligas custom** — se pueden agregar dinámicamente; La Liga / Premier / Serie A son la base.
- ⏳ **Salida de comandos de verificación de entorno** — pendiente de ejecutar para saber qué falta instalar en la máquina Ubuntu.
- ⏳ **Mockups de "Invitar usuario" y "Cambiar contraseña forzosa"** — se harán al llegar al día 4-5 de Fase 1.
- ⏳ **API key de API-Football** — el usuario debe conseguirla antes de arrancar Fase 2.

---

## 16. Comandos de referencia

### Verificación inicial de entorno Ubuntu

```bash
{
  echo "=== Ubuntu ===" && lsb_release -a
  echo "=== nvm ===" && (ls -la ~/.nvm 2>/dev/null | head -3 || echo "NO existe ~/.nvm")
  echo "=== Node ===" && (command -v node && node --version || echo "NO")
  echo "=== npm ===" && (command -v npm && npm --version || echo "NO")
  echo "=== pnpm ===" && (command -v pnpm && pnpm --version || echo "NO")
  echo "=== Angular ===" && (command -v ng && ng version 2>/dev/null | head -5 || echo "NO")
  echo "=== Nest ===" && (command -v nest && nest --version || echo "NO")
  echo "=== Git ===" && (command -v git && git --version || echo "NO")
  echo "=== Docker ===" && (command -v docker && docker --version || echo "NO")
} 2>&1
```

### Comandos Prisma frecuentes

```bash
# Aplicar cambio de schema en dev (preserva datos)
pnpm prisma migrate dev --name descripcion_del_cambio

# Regenerar cliente TypeScript
pnpm prisma generate

# Correr seed (crea admin inicial si no existe)
pnpm prisma db seed

# Ver base gráficamente
pnpm prisma studio

# Botón rojo: reset total (borra dev.db y re-seed)
pnpm prisma migrate reset
```

### Reglas de oro para no perder datos

1. `dev.db` va al `.gitignore` — nunca commitear
2. Seed **siempre** con `upsert`, nunca `create` puro
3. Migrations sí van a Git en `prisma/migrations/`
4. En producción usar `prisma migrate deploy`, nunca `reset`

### Estructura de `.env` (Fase 1)

```env
# apps/api/.env
DATABASE_URL="file:./prisma/dev.db"

# JWT
JWT_SECRET="cambiar-esto-por-string-random-largo"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"

# Admin inicial (solo para primer seed)
ADMIN_EMAIL="tucorreo@ejemplo.com"
ADMIN_PASSWORD="password-fuerte-inicial"
ADMIN_NAME="Tu Nombre"

# API-Football (Fase 2+)
API_FOOTBALL_KEY=""
API_FOOTBALL_HOST="v3.football.api-sports.io"

# Telegram (Fase 4+)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_BOT_USERNAME=""

# Redis (Fase 5+)
REDIS_URL=""
```

---

## Anexo: Historial rápido de la conversación

1. Se retomó proyecto previo de análisis estadístico deportivo (Excel + JSON + API-Football).
2. Usuario pidió reestructurar en Angular con NestJS, mantener caché, opcional Excel, foco en JSON.
3. Se acordó Node + Express inicial → migró a NestJS por interés de aprendizaje.
4. Se definieron todas las fases con CRON incluidos.
5. Se generaron 3 mockups HTML validando dirección visual.
6. Se agregó concepto de roles: ADMIN, ANALYST, VIEWER.
7. Se agregó workflow de solicitudes con aprobación (VIEWER solicita, ADMIN/ANALYST aprueba).
8. Se definió entrega por Telegram (Fase 4) y por app.
9. Se aclaró que la API se llama solo al aprobar, y que el CRON precarga favoritos.
10. Se definió gestión completa de usuarios: invitación manual, password temporal, cambio forzoso al primer login.
11. Se detalló el manejo responsive con Tailwind y la obtención de logos desde API-Football.
12. Se generó este documento maestro.

**Próximo paso:** ejecutar comandos de verificación de entorno y arrancar Fase 1.
