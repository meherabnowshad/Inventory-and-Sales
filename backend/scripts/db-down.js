#!/usr/bin/env node
// IMS-02.4 | Runs every migration's down.sql, newest first, so a local database is fully reset.
// Used by: npm run db:down (backend/package.json). Pair it with npm run db:setup to rebuild.
// Why a script: a down.sql can depend on another (idempotency_keys must go before users),
// and every new migration adds one more. Reading the folders keeps the order right automatically.
// WARNING: deletes all data in the database named by DATABASE_URL. Local development only.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (process.env.NODE_ENV === 'production') {
  console.error('db:down refuses to run when NODE_ENV=production.');
  process.exit(1);
}

const backendDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(backendDir, 'prisma', 'migrations');

// Folder names start with a timestamp, so a descending sort is newest first
const downFiles = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => fs.existsSync(path.join(migrationsDir, name, 'down.sql')))
  .sort()
  .reverse();

if (downFiles.length === 0) {
  console.error('No down.sql files found in prisma/migrations.');
  process.exit(1);
}

for (const name of downFiles) {
  console.log(`\n--- down: ${name}`);
  // Relative path with forward slashes works on Windows, macOS and Linux
  const file = `prisma/migrations/${name}/down.sql`;
  const result = spawnSync(
    'npx',
    ['prisma', 'db', 'execute', '--file', file, '--schema', 'prisma/schema.prisma'],
    { cwd: backendDir, stdio: 'inherit', shell: true },
  );
  if (result.status !== 0) {
    console.error(`\nFailed at ${name}. Stopped; earlier steps were already applied.`);
    process.exit(result.status || 1);
  }
}

console.log('\nAll migrations undone. Run "npm run db:setup" to rebuild.');
