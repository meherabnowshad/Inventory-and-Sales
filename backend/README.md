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
- `prisma/schema.prisma` — PostgreSQL data model (Users, Categories, Products, Sales, SaleItems).
