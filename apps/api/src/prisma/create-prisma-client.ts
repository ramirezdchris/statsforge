import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

export function createPrismaAdapter() {
  return new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  });
}

export function createPrismaClient() {
  return new PrismaClient({ adapter: createPrismaAdapter() });
}
