# Frontend Application — Inventory and Sales Management System

Subtask: **IMS-03.2**  
Non-Functional Requirements covered: **NFR-SEC-03**, **NFR-MNT-01**, **NFR-OPS-01**

## Overview

React 18 single-page application built with Vite, TypeScript, Tailwind CSS, Lucide icons, and React Router v6.

## Quick Start (Single Command)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file if not already copied
cp -n .env.example .env

# 3. Start development server
npm run dev
```

The Vite development server will start on `http://localhost:5173`.

## Available Scripts

- `npm run dev` — Starts Vite dev server with Hot Module Replacement (HMR).
- `npm run build` — Compiles TypeScript and builds optimized production bundles to `dist/`.
- `npm run preview` — Locally previews production build.
- `npm run lint` — Runs ESLint across `src/`.
- `npm run lint:fix` — Fixes auto-fixable lint issues.
- `npm run format` — Formats source files using Prettier.
- `npm run format:check` — Checks formatting using Prettier.

## Routes Configured

- `/` — Overview Dashboard with high-level KPIs and backend connectivity indicator.
- `/inventory` — Inventory management view with search filters and product catalog table.
- `/sales` — Point of sale transaction history and order records.
- `/login` — User authentication skeleton with Role-Based Access Control hints.
- `*` (404) — Not Found fallback route.
