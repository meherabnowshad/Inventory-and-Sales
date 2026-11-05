// IMS-04.2 | Seed entry point. Run with:  npm run db:seed   (or: npx prisma db seed)
// The data and the SQL live in seed-data.ts. Safe to run more than once.
import { PrismaClient } from '@prisma/client';
import { Algorithm, hash } from '@node-rs/argon2';
import { runSeed } from './seed-data.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to load demo seed data when NODE_ENV=production');
  }

  // Demo password for sadia, rafi and mitu. Local development only (see backend/README.md).
  const password = process.env.SEED_PASSWORD ?? 'Smart@1234';
  const passwordHash = await hash(password, { algorithm: Algorithm.Argon2id });

  console.log('Seeding database...');
  const counts = await prisma.$transaction(
    (tx) => runSeed(tx, { passwordHash, log: console.log }),
    {
      timeout: 60_000,
    },
  );
  console.log('Seed finished. Rows now in the database:');
  console.table(counts);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
