# Backend Service — Inventory and Sales Management System

Subtask: **IMS-03.1**  
Non-Functional Requirements covered: **NFR-SEC-03**, **NFR-MNT-01**, **NFR-OPS-01**

## Overview

NestJS 10 REST API written in TypeScript, with Prisma ORM 5 (pinned to 5.22.x) for PostgreSQL, CORS, strict ESLint, and Prettier code standards per SRS Engineering Addendum (v0.3).

## Setup

Use the repository's [README](../README.md) as the single setup guide for the frontend, backend, and PostgreSQL database. It covers environment files, installing dependencies, database migrations and demo data, verification, and starting the application.

## Backend scripts

Run these commands from the repository root with `--workspace=backend`, or from `backend/` without the workspace option.

- `npm run dev` — Starts the NestJS API with hot reload (`nest start --watch`).
- `npm run build` — Compiles TypeScript to `dist/` using Nest CLI (`nest build`).
- `npm run start` — Runs the compiled production code (`node dist/main.js`).
- `npm run lint` — Runs ESLint on `src/`.
- `npm run format` — Formats backend source files with Prettier.
- `npm run prisma:generate` — Generates Prisma Client.
- `npm run db:migrate` — Applies pending migrations (`prisma migrate deploy`).
- `npm run db:seed` — Loads demo data (`prisma db seed`).
- `npm run db:setup` — Applies migrations, then loads demo data.
- `npm run db:down` — Runs every migration's `down.sql`, newest first (`scripts/db-down.js`). This deletes all data in the configured database; use only with a local development database.

## Architecture

- `src/main.ts` — NestJS bootstrap entry point, global `/api` prefix, and CORS configuration.
- `src/app.module.ts` — Root module importing ConfigModule, PrismaModule, HealthModule, InventoryModule, and SalesModule.
- `src/prisma/` — Global PrismaService (lifecycle connect/disconnect) and PrismaModule.
- `src/health/` — HealthController providing `/api/health` status for liveness and database checks.
- `src/inventory/` — InventoryController and InventoryService querying products via Prisma.
- `src/sales/` — SalesController and SalesService querying invoices via Prisma.
- `prisma/schema.prisma` — PostgreSQL data model (14 tables plus `idempotency_keys`).
- `prisma/migrations/` — Database migrations (`migration.sql`, `down.sql`).
- `prisma/seed.ts`, `prisma/seed-data.ts` — Idempotent demo data loader.
