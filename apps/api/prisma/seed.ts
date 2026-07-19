import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  }),
});

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@statsforge.local';
  const password = process.env.ADMIN_PASSWORD ?? 'cambiar-esto-al-primer-login';
  const name = process.env.ADMIN_NAME ?? 'Admin';

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email,
      name,
      role: Role.ADMIN,
      passwordHash,
      mustChangePassword: true,
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'app.name' },
    update: {},
    create: {
      key: 'app.name',
      value: 'StatsForge',
      category: 'branding',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'security.loginRateLimit' },
    update: {},
    create: {
      key: 'security.loginRateLimit',
      value: '5',
      category: 'security',
    },
  });

  const markets = [
    {
      key: 'OVER_UNDER_25',
      label: 'Over/Under 2.5',
      description: 'Frecuencia de partidos con mas de 2.5 goles.',
      category: 'goals',
      sortOrder: 10,
    },
    {
      key: 'BTTS',
      label: 'Ambos marcan',
      description: 'Porcentaje de partidos donde ambos equipos anotan.',
      category: 'goals',
      sortOrder: 20,
    },
    {
      key: 'CORNERS',
      label: 'Corners',
      description: 'Promedios de tiros de esquina por equipo y total proyectado.',
      category: 'set-pieces',
      sortOrder: 30,
    },
    {
      key: 'TOTAL_SHOTS',
      label: 'Remates totales',
      description: 'Promedios de remates totales y ultimo valor contra el 80%.',
      category: 'shots',
      sortOrder: 35,
    },
    {
      key: 'SHOTS_ON_TARGET',
      label: 'Tiros a puerta',
      description: 'Promedios de tiros a puerta y ultimo valor contra el 80%.',
      category: 'shots',
      sortOrder: 40,
    },
    {
      key: 'CARDS',
      label: 'Tarjetas',
      description: 'Promedio reciente de tarjetas amarillas y rojas.',
      category: 'discipline',
      sortOrder: 50,
    },
    {
      key: 'YELLOW_CARDS',
      label: 'Tarjetas amarillas',
      description: 'Promedio y ultimo valor de amarillas contra el 80%.',
      category: 'discipline',
      sortOrder: 51,
    },
    {
      key: 'RED_CARDS',
      label: 'Tarjetas rojas',
      description: 'Promedio reciente de tarjetas rojas.',
      category: 'discipline',
      sortOrder: 52,
    },
    {
      key: 'FIRST_HALF_GOALS',
      label: 'Goles 1T',
      description: 'Tendencia de goles durante el primer tiempo.',
      category: 'halves',
      sortOrder: 60,
    },
    {
      key: 'SECOND_HALF_GOALS',
      label: 'Goles 2T',
      description: 'Tendencia de goles durante el segundo tiempo.',
      category: 'halves',
      sortOrder: 70,
    },
    {
      key: 'MATCH_RESULT_1X2',
      label: 'Resultado 1X2',
      description: 'Forma reciente, puntos por partido y senal de resultado.',
      category: 'result',
      sortOrder: 80,
    },
    {
      key: 'TEAM_FORM',
      label: 'Forma del equipo',
      description: 'Record V-E-D, puntos por partido y splits local/visitante.',
      category: 'form',
      sortOrder: 90,
    },
    {
      key: 'H2H',
      label: 'Enfrentamientos directos',
      description: 'Historial directo con over, BTTS y resultados.',
      category: 'history',
      sortOrder: 100,
    },
    {
      key: 'SCORER',
      label: 'Goleadores',
      description: 'Top goleadores y rendimiento en club actual cuando hay cobertura.',
      category: 'players',
      sortOrder: 110,
    },
  ];

  for (const market of markets) {
    await prisma.market.upsert({
      where: { key: market.key },
      update: market,
      create: market,
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SEED_ADMIN',
      metadata: JSON.stringify({ email }),
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
