# Backend Service — Inventory and Sales Management System

Subtask: **IMS-03.1**  
Non-Functional Requirements covered: **NFR-SEC-03**, **NFR-MNT-01**, **NFR-OPS-01**

## Overview

Express.js REST API written in TypeScript, configured with Prisma ORM for PostgreSQL, helmet for security headers, CORS, morgan request logging, and ESLint / Prettier code standards.

## Quick Start (Single Command)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file if not already copied
cp -n .env.example .env

# 3. Start development server (with hot-reload via tsx)
npm run dev
```

The server will boot on `http://localhost:5001`.
Verify health by visiting: `http://localhost:5001/api/health`.

## Available Scripts

- `npm run dev` — Starts backend in development mode with live reload.
- `npm run build` — Compiles TypeScript code to `dist/`.
- `npm run start` — Runs the compiled production code from `dist/server.js`.
- `npm run lint` — Runs ESLint across `src/`.
- `npm run lint:fix` — Fixes auto-fixable lint issues.
- `npm run format` — Formats files using Prettier.
- `npm run format:check` — Checks formatting using Prettier.
- `npm run prisma:generate` — Generates Prisma Client.
- `npm run prisma:migrate` — Applies Prisma migrations to your PostgreSQL database.

## Architecture

- `src/server.ts` — Server entry point and graceful shutdown handlers.
- `src/app.ts` — Express application configuration, middlewares, and route mounting.
- `src/config/` — Environment variable validation (`env.ts`) and Prisma client (`prisma.ts`).
- `src/controllers/` — Route controllers (e.g. `health.controller.ts`).
- `src/routes/` — Modular route definitions (`health.routes.ts`, `inventory.routes.ts`, `sales.routes.ts`).
- `src/middlewares/` — Centralized error handler and request logger.
- `prisma/schema.prisma` — PostgreSQL data model (14 tables from SRS section 5, see `docs/database/schema.md`).
- `prisma/migrations/` — SQL migration (`migration.sql`) and its reverse (`down.sql`).
- `prisma/seed.ts`, `prisma/seed-data.ts` — demo data loader (IMS-04.2).

## Database setup (IMS-04)

Subtask: **IMS-04.3** — goal: a new person gets a working, seeded database from this section alone in under 30 minutes (NFR-MNT-01).

### Requirements

| Tool       | Version                                          |
| ---------- | ------------------------------------------------ |
| Node.js    | 20 LTS                                           |
| PostgreSQL | 16 (installed natively or via Docker, port 5432) |
| Git        | any recent version                               |

### 1. Create the database user and database

Open **SQL Shell (psql)** (or `psql -U postgres`) as the `postgres` superuser and run:

```sql
CREATE USER smartmart WITH PASSWORD 'smartmart_dev' CREATEDB;
CREATE DATABASE inventory_sales_db OWNER smartmart;
```

`CREATEDB` is needed because Prisma creates a temporary "shadow" database for some commands.

### 2. Install dependencies (repo root)

```bash
npm install
```

### 3. Create the `.env` files (repo root)

```bash
npm run setup:env
```

This copies `backend/.env.example` to `backend/.env`. The default `DATABASE_URL` already matches step 1:

```
DATABASE_URL="postgresql://smartmart:smartmart_dev@localhost:5432/inventory_sales_db?schema=public"
```

`backend/.env` is ignored by Git. Never commit it.

### 4. Create the tables and load demo data (`backend/`)

```bash
cd backend
npm run db:setup
```

`db:setup` runs `prisma migrate deploy` (creates the 14 tables, rules and triggers) and then `prisma db seed` (loads demo data). Both are safe to run again.

### 5. Verify

In SQL Shell, connect to database `inventory_sales_db` as user `smartmart`, then:

```sql
\dt
SELECT username, left(password_hash, 10) AS hash_start FROM users ORDER BY id;
SELECT sku, name, stock_qty, min_stock FROM products ORDER BY id;
```

Expected:

- `\dt` lists 14 tables plus `_prisma_migrations`.
- 3 users, every `hash_start` is `$argon2id$`.
- 5 products with stock 50 / 40 / 12 / 60 / 6. `CH-20W` (6) is below its minimum of 10 on purpose, to demo the low-stock list.

`\dt` is a psql command. It does not work in PowerShell or cmd.

### 6. Demo users

All demo users share one password: `Smart@1234` (override with `SEED_PASSWORD` before running the seed).

| Username | Role          |
| -------- | ------------- |
| `sadia`  | Administrator |
| `rafi`   | Sales Staff   |
| `mitu`   | Store Staff   |

The seed refuses to run when `NODE_ENV=production`.

### Reset the database (`backend/`)

```bash
npm run db:down    # drops all tables and the migration record
npm run db:setup   # creates and seeds again
```

`db:down` deletes all data in this database. Use it only on your local development database.

### Database scripts

| Script               | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `npm run db:migrate` | `prisma migrate deploy`: applies pending migrations |
| `npm run db:seed`    | loads demo data (idempotent)                        |
| `npm run db:setup`   | `db:migrate` then `db:seed`                         |
| `npm run db:down`    | runs `down.sql`: drops everything                   |

### Troubleshooting

| Problem                                        | Fix                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `P1000 Authentication failed`                  | Wrong user or password in `backend/.env`. Redo step 1 and check `DATABASE_URL`. |
| `P1001 Can't reach database server`            | PostgreSQL is not running or not on port 5432. Start the PostgreSQL service.    |
| `P1003 Database ... does not exist`            | Create `inventory_sales_db` (step 1).                                           |
| `permission denied to create database`         | The user needs `CREATEDB`: `ALTER USER smartmart CREATEDB;`                     |
| `Cannot find module '@node-rs/argon2'`         | Run `npm install` at the repo root.                                             |
| `Environment variable not found: DATABASE_URL` | Run the commands from `backend/` and make sure `backend/.env` exists (step 3).  |
| `\dt` gives a syntax error                     | You are in PowerShell. Open SQL Shell (psql) instead.                           |

### Setup check results (IMS-04.3)

Each person follows steps 1 to 6 on a clean machine and fills one row.

| Person  | OS         | Node    | PostgreSQL | Migrate OK? | Seed OK? | Minutes |
| ------- | ---------- | ------- | ---------- | ----------- | -------- | ------- |
| Rashad  | Windows 11 | 20.20.2 | 16.15      |             |          |         |
| Meherab |            |         |            |             |          |         |
| Radouan |            |         |            |             |          |         |
| QA 2    |            |         |            |             |          |         |
