# Backend Service — Inventory and Sales Management System

Subtask: **IMS-03.1**  
Non-Functional Requirements covered: **NFR-SEC-03**, **NFR-MNT-01**, **NFR-OPS-01**

## Overview

Express.js REST API written in TypeScript, with Prisma ORM for PostgreSQL, Helmet, CORS, Morgan request logging, ESLint, and Prettier.

## Setup

Use the repository's [README](../README.md) as the single setup guide for the frontend, backend, and PostgreSQL database. It covers environment files, installing dependencies, database migrations and demo data, verification, and starting the application.

## Backend scripts

Run these commands from the repository root with `--workspace=backend`, or from `backend/` without the workspace option.

- `npm run dev` — Starts the API with hot reload.
- `npm run build` — Compiles TypeScript to `dist/`.
- `npm run start` — Runs the production build.
- `npm run lint` — Runs ESLint on `src/`.
- `npm run format` — Formats backend source files with Prettier.
- `npm run prisma:generate` — Generates Prisma Client.
- `npm run db:migrate` — Applies pending migrations.
- `npm run db:seed` — Loads demo data.
- `npm run db:setup` — Applies migrations, then loads demo data.
- `npm run db:down` — Drops tables in the configured database. This deletes data; use only with a local development database.

## Architecture

- `src/server.ts` — Server entry point and graceful shutdown handlers.
- `src/app.ts` — Express application configuration, middleware, and route mounting.
- `src/config/` — Environment validation and Prisma client.
- `src/controllers/` — Route controllers.
- `src/routes/` — Modular REST route definitions.
- `src/middlewares/` — Centralized error handling and request logging.
- `prisma/schema.prisma` — PostgreSQL data model.
- `prisma/migrations/` — Database migrations.
- `prisma/seed.ts`, `prisma/seed-data.ts` — Demo data loader.
