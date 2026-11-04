# Inventory and Sales Management System (IMS)

[![CI Pipeline](https://github.com/group-1/inventory-and-sales/actions/workflows/ci.yml/badge.svg)](https://github.com/group-1/inventory-and-sales/actions)
![Node Version](https://img.shields.io/badge/Node.js-v18%2B-blue?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Express](https://img.shields.io/badge/Backend-Express.js-black?logo=express)
![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb?logo=react)
![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)
![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS-38bdf8?logo=tailwindcss)

**Group 1 SRS Baseline — Sprint 1 Kick-off**  
**Assignee:** Meherab (Dev 2)  
**Covers:** `NFR-SEC-03`, `NFR-MNT-01`, `NFR-OPS-01`

---

## 📋 Table of Contents

1. [Overview & Architecture](#-overview--architecture)
2. [Sprint 1 Scope & Subtasks](#-sprint-1-scope--subtasks)
3. [Prerequisites](#-prerequisites)
4. [Quick Start (Single Command)](#-quick-start-single-command)
5. [Detailed Setup Steps](#-detailed-setup-steps)
6. [Available Monorepo Commands](#-available-monorepo-commands)
7. [API & Verification Endpoints](#-api--verification-endpoints)
8. [Code Quality & Standards](#-code-quality--standards)
9. [Branch Protection & PR Workflow](#-branch-protection--pr-workflow)
10. [Troubleshooting](#-troubleshooting)

---

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

---

## 🎯 Sprint 1 Scope & Subtasks

| Task ID      | Task Description                                     | Assignee | Done Criteria                      | NFR Covered                              |
| :----------- | :--------------------------------------------------- | :------- | :--------------------------------- | :--------------------------------------- |
| **IMS-03.1** | Backend repo: skeleton, lint, format, `.env.example` | Meherab  | Backend starts with one command    | `NFR-SEC-03`, `NFR-MNT-01`, `NFR-OPS-01` |
| **IMS-03.2** | Frontend repo: skeleton, routing, lint, format       | Meherab  | Frontend starts with one command   | `NFR-SEC-03`, `NFR-MNT-01`, `NFR-OPS-01` |
| **IMS-03.3** | Branch protection and pull request template          | Meherab  | `main` needs a PR & 1 approval     | `NFR-MNT-01`, `NFR-SEC-03`               |
| **IMS-03.4** | README with setup steps                              | Meherab  | Teammate sets up from README alone | `NFR-OPS-01`                             |

---

## 💻 Prerequisites

Ensure your development machine has the following installed:

- **Node.js**: `v18.0.0` or higher (`v22` recommended). Check with `node -v`.
- **npm**: `v9.0.0` or higher (`v10+` recommended). Check with `npm -v`.
- **Git**: `v2.20.0` or higher. Check with `git -v`.
- _(Optional for full DB features)_ **PostgreSQL**: `v14+` or Docker running PostgreSQL.

---

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

- 🖥️ **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- 📡 **Backend Health Check**: [http://localhost:5001/api/health](http://localhost:5001/api/health)

---

## 📖 Detailed Setup Steps

If you prefer to configure and run the services individually:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "Inventory and Sales"
```

### 2. Install Dependencies

```bash
# Installs root, backend, and frontend dependencies in one pass using npm workspaces
npm install
```

### 3. Configure Backend Environment (NFR-SEC-03)

Navigate to `backend/` and initialize your `.env` file:

```bash
cd backend
cp .env.example .env
```

Key configuration parameters inside `backend/.env`:

```ini
PORT=5001
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inventory_sales_db?schema=public"
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

Key parameters in `frontend/.env`:

```ini
VITE_API_BASE_URL=http://localhost:5000/api
```

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

## 📐 Code Quality & Standards (NFR-MNT-01)

- **TypeScript Strict Mode**: Both services enforce strict type checks.
- **ESLint**: Standardized rules for JavaScript, TypeScript, and React hooks.
- **Prettier**: Single quotes, 2-space indentation, 100 character line width, trailing commas.

Run checks locally prior to committing:

```bash
npm run lint
npm run format:check
```

---

## 🔒 Branch Protection & PR Workflow (IMS-03.3)

Direct commits to the `main` branch are blocked.

1. **Create a topic branch**:
   ```bash
   git checkout -b feature/IMS-XX-description
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
   - Complete the NFR checklist (**NFR-SEC-03**, **NFR-MNT-01**, **NFR-OPS-01**).
   - Ensure all GitHub Actions CI checks pass.
   - Receive at least **1 approval** from a teammate before merging.
   - See [BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md) for full configuration details.

---

## ❓ Troubleshooting

### 1. Port 5000 or 5173 is already in use

- **Backend**: You can change `PORT=5001` inside `backend/.env`. Update `frontend/.env` to point `VITE_API_BASE_URL=http://localhost:5001/api`.
- **Frontend**: Vite will automatically offer the next available port (e.g. `5174`), or specify `--port 5174` in `frontend/package.json`.

### 2. PostgreSQL database connection warning

- The backend skeleton is designed to start **cleanly** even if PostgreSQL is not yet running on your computer.
- The health endpoint (`/api/health`) will report `"status": "UP"` and note that the database is in skeleton mode until a PostgreSQL server is started at `DATABASE_URL`.

### 3. Node version incompatibility

- Ensure you are running Node.js `>= 18.0.0`. Run `node -v` to verify. We recommend managing Node versions using [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  nvm use 22
  ```

---

_Authored by Dev 2 (Meherab) • Group 1 Inventory and Sales Project • Sprint 1_
