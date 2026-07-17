import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/client';
import { createPrismaClient } from '../src/prisma/create-prisma-client';

const prisma = createPrismaClient();

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
