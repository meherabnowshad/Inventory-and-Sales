import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      message: 'PostgreSQL connection verified via Prisma.',
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown database error';
    return {
      connected: false,
      message: `Database connection unavailable (skeleton mode): ${errMessage}`,
    };
  }
}
