/**
 * Database client — singleton Prisma instance.
 * Exports a single PrismaClient so connections are reused across the app.
 */
let prisma: any = null;

export function getPrisma(): any {
  if (!prisma) {
    try {
      const { PrismaClient } = require('@prisma/client');
      prisma = new PrismaClient({
        log: ['error'],
      });
    } catch {
      console.warn('[db] @prisma/client not generated yet — DB operations will be skipped.');
    }
  }
  return prisma;
}
