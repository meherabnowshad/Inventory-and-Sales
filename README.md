# Inventory and Sales Management System (IMS)

[![CI - main](https://github.com/meherabnowshad/Inventory-and-Sales/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/meherabnowshad/Inventory-and-Sales/actions/workflows/ci.yml)
[![CI - master](https://github.com/meherabnowshad/Inventory-and-Sales/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/meherabnowshad/Inventory-and-Sales/actions/workflows/ci.yml)

## 📋 Table of Contents

1. [Overview &amp; Architecture](#overview-architecture)
2. [Prerequisites](#prerequisites)
3. [Quick Start (Single Command)](#quick-start-single-command)
4. [Detailed Setup Steps](#detailed-setup-steps)
5. [Database Setup](#database-setup)
6. [Backend Service](#backend-service)
7. [Frontend Application](#frontend-application)
8. [Available Monorepo Commands](#available-monorepo-commands)
9. [API &amp; Verification Endpoints](#api-verification-endpoints)
10. [Code Quality &amp; Standards](#code-quality-standards)
11. [Branch Protection &amp; PR Workflow](#branch-protection-pr-workflow)
12. [Troubleshooting](#troubleshooting)

---

<a id="overview-architecture"></a>

## 🏛 Overview & Architecture

The **Inventory and Sales Management System (IMS)** is a multi-tier enterprise web application designed for retail inventory tracking, stock alerts, point-of-sale transactions, and role-based operational management.

### Monorepo Structure

```text
Inventory and Sales/
├── .github/
│   ├── workflows/ci.yml              # GitHub Actions automated lint & build pipeline
│   ├── BRANCH_PROTECTION.md          # Branch protection policy for main
│   └── pull_request_template.md      # Standardized PR template with NFR checklist
├── backend/                          # Express + TypeScript + Prisma REST API
│   ├── prisma/schema.prisma          # PostgreSQL relational schema
│   ├── src/
│   │   ├── config/                   # Typed env variables & Prisma client
│   │   ├── controllers/              # Business controllers (health, products, sales)
│   │   ├── middlewares/              # Security headers, logging, error handling
│   │   ├── routes/                   # Modular REST routes
│   │   ├── app.ts                    # Express application factory
│   │   └── server.ts                 # Server entry point & graceful shutdown
│   ├── .env.example                  # Environment configuration template
│   └── package.json
├── frontend/                         # React 18 + Vite + Tailwind CSS SPA
│   ├── src/
│   │   ├── components/layout/        # Header, Sidebar, Main Layout
│   │   ├── pages/                    # Dashboard, Inventory, Sales, Login, 404
│   │   ├── services/api.ts           # Axios client configured with backend proxy
│   │   ├── App.tsx                   # React Router v6 navigation
│   │   └── main.tsx                  # Application entry point
│   ├── .env.example                  # Frontend environment configuration template
│   └── package.json
├── package.json                      # Root workspace orchestration
└── README.md                         # Teammate setup guide (this document)
```

For complete component-specific architectures, routes, and individual command references, see the dedicated [Backend Service](#backend-service) and [Frontend Application](#frontend-application) sections below. This root README is the unified single source of truth for the entire monorepo, both services, and the database.

---

<a id="prerequisites"></a>

## 💻 Prerequisites

Ensure your development machine has the following installed:

- **Node.js 20 LTS** and npm (Node.js 22 also works). Check with `node -v` and `npm -v`.
- **Git**. Check with `git --version`.
- **PostgreSQL 16** (native install or Docker) for the backend and seeded demo data. The frontend can start without PostgreSQL.

---

<a id="quick-start-single-command"></a>

## ⚡ Quick Start (Single Command)

If you have just cloned this repository, follow these 3 quick commands:

```bash
# 1. Install all dependencies across root, backend, and frontend
npm install

# 2. Copy the environment configuration files from templates
npm run setup:env

# 3. Start BOTH backend and frontend concurrently with ONE command
npm run dev
```

That's it!

For the backend with seeded data, complete [Database Setup](#database-setup) before starting the services. The frontend can run without PostgreSQL.

- 🖥️ **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- 📡 **Backend Health Check**: [http://localhost:5001/api/health](http://localhost:5001/api/health)

---

<a id="detailed-setup-steps"></a>

## 📖 Detailed Setup Steps

If you prefer to configure and run the services individually:

### 1. Clone the Repository

```bash
git clone https://github.com/meherabnowshad/Inventory-and-Sales.git
cd Inventory-and-Sales
```

### 2. Install Dependencies

```bash
# Installs root, backend, and frontend dependencies in one pass using npm workspaces
npm install
```

### 3. Configure Backend Environment

Navigate to `backend/` and initialize your `.env` file:

```bash
cd backend
cp .env.example .env
```

Key configuration parameters inside `backend/.env`:

```ini
PORT=5001
NODE_ENV=development
DATABASE_URL="postgresql://smartmart:smartmart_dev@localhost:5432/inventory_sales_db?schema=public"
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=super_secret_jwt_dev_key_change_in_production_32chars
```

Generate Prisma client:

```bash
npm run prisma:generate
```

### 4. Configure Frontend Environment

Navigate to `frontend/` and initialize your `.env` file:

```bash
cd ../frontend
cp .env.example .env
```

The default settings in `frontend/.env`:

```ini
VITE_API_BASE_URL=/api
```

Vite forwards `/api` requests to `http://localhost:5001/api`.

### 5. Running the Services

#### Option A: Run Both Together (Recommended)

From the repository root:

```bash
npm run dev
```

#### Option B: Run Backend Only

From root:

```bash
npm run dev:backend
```

_(Or inside `backend/`: `npm run dev`)_

#### Option C: Run Frontend Only

From root:

```bash
npm run dev:frontend
```

_(Or inside `frontend/`: `npm run dev`)_

---

<a id="database-setup"></a>

## 🗄️ Database Setup

The database steps below complete the setup guide for a new developer. Use PostgreSQL 16, started locally or in Docker, and run these commands from the repository root unless noted otherwise.

### Create the development database

Open `psql` as a PostgreSQL administrator (for example, `psql -U postgres`) and create the local application role and database:

```sql
CREATE USER smartmart WITH PASSWORD 'smartmart_dev' CREATEDB;
CREATE DATABASE inventory_sales_db OWNER smartmart;
```

The default `DATABASE_URL` in `backend/.env` must use the same credentials and database:

```text
DATABASE_URL="postgresql://smartmart:smartmart_dev@localhost:5432/inventory_sales_db?schema=public"
```

If you change the local role password or PostgreSQL port, update `DATABASE_URL` accordingly. Do not commit `.env` files.

### Apply the schema and seed demo data

From the repository root:

```bash
npm run db:setup --workspace=backend
```

This applies the checked-in migration and loads demo data. It is safe to rerun.

### Verify the database

Connect to `inventory_sales_db` as `smartmart` using `psql`, then run:

```sql
\dt
SELECT username, left(password_hash, 10) AS hash_start FROM users ORDER BY id;
SELECT sku, name, stock_qty, min_stock FROM products ORDER BY id;
```

Expected results:

- `\dt` lists 15 application tables plus `_prisma_migrations`.
- 3 demo users have password hashes beginning with `$argon2id$`.
- 5 products are seeded; `CH-20W` has 6 in stock (below its minimum of 10) to demonstrate low-stock status.

`\dt` is a `psql` command; run it in SQL Shell/psql, not PowerShell or Command Prompt.

### Demo accounts

All demo accounts use `Smart@1234` by default. Set `SEED_PASSWORD` before seeding to override it.

| Username | Role          |
| -------- | ------------- |
| `sadia`  | Administrator |
| `rafi`   | Sales Staff   |
| `mitu`   | Store Staff   |

The seed script refuses to run when `NODE_ENV=production`.

### Reset a local database

The following commands **delete all data** in the configured database. Use them only for a local development database:

```bash
npm run db:down --workspace=backend
npm run db:setup --workspace=backend
```

| Command                                  | Purpose                                         |
| ---------------------------------------- | ----------------------------------------------- |
| `npm run db:migrate --workspace=backend` | Applies pending migrations                      |
| `npm run db:seed --workspace=backend`    | Loads demo data (idempotent)                    |
| `npm run db:setup --workspace=backend`   | Applies migrations, then seeds                  |
| `npm run db:down --workspace=backend`    | Runs every migration's `down.sql`, newest first |

### Database troubleshooting

| Error                                          | What to check                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `P1000 Authentication failed`                  | Check the username/password in `backend/.env` and the PostgreSQL role created above. |
| `P1001 Can't reach database server`            | Start PostgreSQL and confirm it listens on port `5432`.                              |
| `P1003 Database ... does not exist`            | Create `inventory_sales_db` and confirm `DATABASE_URL` names it.                     |
| `permission denied to create database`         | Recreate the local role with `CREATEDB` or run `ALTER USER smartmart CREATEDB;`.     |
| `Environment variable not found: DATABASE_URL` | Run `npm run setup:env` from the repository root and check `backend/.env`.           |
| `Cannot find module '@node-rs/argon2'`         | Run `npm install` at the repository root.                                            |
| `\dt` gives a syntax error                     | Run it in `psql`/SQL Shell, not in PowerShell or Command Prompt.                     |

### Setup Verification

Each team member follows steps 1 to 6 on their local machine and records their verification status:

| Person  | OS                    | Node    | PostgreSQL | Migrate OK? | Seed OK? | Minutes |
| ------- | --------------------- | ------- | ---------- | ----------- | -------- | ------- |
| Rashad  | Windows 11            | 20.20.2 | 16.15      | Yes         | Yes      | ~10     |
| Meherab | macOS (Apple Silicon) | 22.23.1 | 16.15      | Yes         | Yes      | ~5      |
| Radouan | Windows 11            | 22.23.1 | 16.15      | Yes         | Yes      | ~5      |
| Rejwana | Windows 11            | 20.20.2 | 16.15      | Yes         | Yes      | ~15     |

---

<a id="backend-service"></a>

## ⚙️ Backend Service

The backend is a NestJS 10 REST API written in TypeScript with Prisma ORM 5 (pinned to 5.22.x) for PostgreSQL, CORS, strict ESLint, and Prettier formatting standards per SRS Engineering Addendum (v0.3).

### Backend Internal Architecture

- `backend/src/main.ts` — NestJS bootstrap entry point, global `/api` prefix, and CORS configuration.
- `backend/src/app.module.ts` — Root module importing ConfigModule, PrismaModule, HealthModule, InventoryModule, and SalesModule.
- `backend/src/prisma/` — Global PrismaService (lifecycle connect/disconnect) and PrismaModule.
- `backend/src/health/` — HealthController providing `/api/health` status for liveness and database checks.
- `backend/src/inventory/` — InventoryController and InventoryService querying products via Prisma.
- `backend/src/sales/` — SalesController and SalesService querying invoices via Prisma.
- `backend/prisma/schema.prisma` — PostgreSQL relational data model (14 tables per SRS Section 5, plus `idempotency_keys`).
- `backend/prisma/migrations/` — SQL migration scripts (`migration.sql`) and down scripts (`down.sql`).
- `backend/prisma/seed.ts`, `backend/prisma/seed-data.ts` — Idempotent demo data loader.

### Backend Standalone Scripts

Commands can be run from repository root using `--workspace=backend`, or directly within the `backend/` directory:

| Command                   | Root Workspace Invocation                     | Description                                                           |
| :------------------------ | :-------------------------------------------- | :-------------------------------------------------------------------- |
| `npm run dev`             | `npm run dev:backend`                         | Starts backend with hot-reload via Nest CLI (`nest start --watch`).   |
| `npm run build`           | `npm run build:backend`                       | Compiles TypeScript into `backend/dist/` via Nest CLI (`nest build`). |
| `npm run start`           | `npm run start --workspace=backend`           | Executes compiled production build from `dist/main.js`.               |
| `npm run lint`            | `npm run lint --workspace=backend`            | Runs ESLint across `backend/src/`.                                    |
| `npm run lint:fix`        | `npm run lint:fix --workspace=backend`        | Fixes auto-fixable lint issues in backend.                            |
| `npm run format`          | `npm run format --workspace=backend`          | Formats backend source files with Prettier.                           |
| `npm run prisma:generate` | `npm run prisma:generate --workspace=backend` | Generates latest Prisma Client.                                       |
| `npm run db:migrate`      | `npm run db:migrate --workspace=backend`      | Applies pending Prisma migrations (`prisma migrate deploy`).          |
| `npm run db:seed`         | `npm run db:seed --workspace=backend`         | Runs idempotent seed loader (`prisma db seed`).                       |
| `npm run db:setup`        | `npm run db:setup --workspace=backend`        | Runs migrations and seeds in one command.                             |
| `npm run db:down`         | `npm run db:down --workspace=backend`         | Undoes every migration with its `down.sql` (use only in local dev).   |

---

<a id="frontend-application"></a>

## 💻 Frontend Application

The frontend is a modern Single Page Application (SPA) built with React 18, Vite, TypeScript, Tailwind CSS, Lucide icons, Vitest, React Testing Library, and React Router v6.

### Frontend Application Routes

| Route        | View                | Description                                                                                                                  |
| :----------- | :------------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| `/`          | **Dashboard**       | Overview dashboard with metric KPI cards, recent activity, and live backend connectivity status.                             |
| `/inventory` | **Inventory**       | Real-time product inventory table, stock status indicators (In Stock, Low Stock, Out of Stock), category filter, and search. |
| `/sales`     | **Sales History**   | Point of sale transaction records aligned with the Prisma schema with BDT currency formatting.                               |
| `/login`     | **Authentication**  | Login screen with email format validation, password reveal toggle, role previews, and generic security errors.               |
| `/no-access` | **Forbidden (403)** | Role-based navigation guard fallback when a user attempts to access an unauthorized route.                                   |
| `*`          | **Not Found (404)** | Catch-all fallback route rendered in-place while preserving user URL.                                                        |

### Frontend Standalone Scripts

Commands can be run from repository root using `--workspace=frontend`, or directly within the `frontend/` directory:

| Command                | Root Workspace Invocation                   | Description                                                               |
| :--------------------- | :------------------------------------------ | :------------------------------------------------------------------------ |
| `npm run dev`          | `npm run dev:frontend`                      | Starts Vite dev server with Hot Module Replacement on port `5173`.        |
| `npm run build`        | `npm run build:frontend`                    | Type-checks with `tsc` and bundles production assets to `frontend/dist/`. |
| `npm run test`         | `npm run test:frontend`                     | Runs Vitest automated component and unit test suites.                     |
| `npm run preview`      | `npm run preview --workspace=frontend`      | Locally previews production build.                                        |
| `npm run lint`         | `npm run lint --workspace=frontend`         | Runs ESLint across `frontend/src/`.                                       |
| `npm run lint:fix`     | `npm run lint:fix --workspace=frontend`     | Fixes auto-fixable lint issues in frontend.                               |
| `npm run format`       | `npm run format --workspace=frontend`       | Formats frontend source files with Prettier.                              |
| `npm run format:check` | `npm run format:check --workspace=frontend` | Verifies frontend formatting without writing changes.                     |

---

<a id="available-monorepo-commands"></a>

## 🛠 Available Monorepo Commands

| Command                  | Purpose                                                      |
| :----------------------- | :----------------------------------------------------------- |
| `npm run dev`            | Starts Backend (`:5001`) and Frontend (`:5173`) concurrently |
| `npm run dev:backend`    | Starts Backend with hot-reloading (`tsx`)                    |
| `npm run dev:frontend`   | Starts Frontend with Vite HMR                                |
| `npm run build`          | Compiles both backend and frontend for production            |
| `npm run build:backend`  | Compiles backend TypeScript to `backend/dist`                |
| `npm run build:frontend` | Bundles frontend static assets to `frontend/dist`            |
| `npm run lint`           | Runs ESLint on both backend and frontend                     |
| `npm run lint:fix`       | Fixes auto-fixable linting issues in both packages           |
| `npm run format`         | Runs Prettier across all source code                         |
| `npm run format:check`   | Verifies code formatting across the repository               |
| `npm run setup:env`      | Copies `.env.example` to `.env` in both packages             |

---

<a id="api-verification-endpoints"></a>

## 🩺 API & Verification Endpoints

When the backend is running, verify system health:

- **Root API Index**: `GET http://localhost:5001/`
  ```json
  {
    "name": "Inventory and Sales Management System API",
    "status": "operational",
    "healthCheck": "/api/health",
    "docs": "/api"
  }
  ```
- **Health Check**: `GET http://localhost:5001/api/health`
  ```json
  {
    "status": "UP",
    "service": "Inventory and Sales Backend API",
    "version": "1.0.0",
    "environment": "development",
    "uptimeSeconds": 24,
    "database": {
      "connected": false,
      "message": "Database connection unavailable (skeleton mode): ..."
    },
    "timestamp": "2026-11-04T00:00:00.000Z"
  }
  ```
- **Inventory Summary**: `GET http://localhost:5001/api/inventory`
- **Sales Summary**: `GET http://localhost:5001/api/sales`

---

<a id="code-quality-standards"></a>

## 📐 Code Quality & Standards

- **TypeScript Strict Mode**: Both services enforce strict type checks.
- **ESLint**: Standardized rules for JavaScript, TypeScript, and React hooks.
- **Prettier**: Single quotes, 2-space indentation, 100 character line width, trailing commas.

Run checks locally prior to committing:

```bash
npm run lint
npm run format:check
```

---

<a id="branch-protection-pr-workflow"></a>

## 🔒 Branch Protection & PR Workflow

Direct commits to the `main` and `master` branches are blocked. All changes must be introduced through a Pull Request that satisfies the following:

- **Required Status Checks**: All 4 automated GitHub Actions CI checks must be green:
  1. `Code Formatting & Secret Audit (NFR-SEC-03, NFR-MNT-01)`
  2. `Backend Lint & Typecheck (NFR-MNT-01, NFR-OPS-01)`
  3. `Frontend Lint & Build (NFR-MNT-01, NFR-OPS-01)`
  4. `API Tests against Test Database (NFR-OPS-01)`
- **Merge Blocking**: Any failing check or unaddressed review comment strictly blocks merging (**NFR-OPS-01**).
- **Peer Approval**: At least **1 approved review** from a peer is required before merge.

1. **Create a topic branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Develop and test**:
   ```bash
   npm run lint
   npm run format:check
   npm run dev
   ```
3. **Commit following conventional commit messages**:
   ```bash
   git commit -m "feat(backend): implement product catalog API"
   ```
4. **Push & Open a Pull Request**:
   - The Pull Request template (`.github/pull_request_template.md`) will automatically populate.
   - Complete the code quality and security checklist.
   - Ensure all GitHub Actions CI checks pass.
   - Receive at least **1 approval** from a teammate before merging.
   - See [BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md) for full configuration details.

---

<a id="troubleshooting"></a>

## ❓ Troubleshooting

### 1. Port 5001 or 5173 is already in use

- **Backend**: Change `PORT` in `backend/.env` and update `CORS_ORIGIN` and the Vite proxy target in `frontend/vite.config.ts` accordingly.
- **Frontend**: `strictPort` is enabled, so Vite exits if `5173` is busy. Free the port or start it with `npm run dev:frontend -- --port 5174`.

### 2. PostgreSQL database connection warning

- The backend skeleton is designed to start **cleanly** even if PostgreSQL is not yet running on your computer.
- The health endpoint (`/api/health`) will report `"status": "UP"` and note that the database is in skeleton mode until a PostgreSQL server is started at `DATABASE_URL`.

### 3. Node version incompatibility

- Ensure you are running Node.js 20 LTS (Node.js 22 also works). Run `node -v` to verify. We recommend managing Node versions using [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  nvm use 22
  ```

---

_Authored by Meherab Hossain Nowshad, Md Rashadul Islam, Rejawana Tabassum, Radouan Ahmed • Inventory and Sales Management System_
