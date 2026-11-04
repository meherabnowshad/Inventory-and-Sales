# Frontend Application — Inventory and Sales Management System

Subtask: **IMS-03.2**  
Non-Functional Requirements covered: **NFR-SEC-03**, **NFR-MNT-01**, **NFR-OPS-01**

## Overview

React 18 single-page application built with Vite, TypeScript, Tailwind CSS, Lucide icons, Vitest + React Testing Library, and React Router v6.

## Quick Start (Single Command)

```bash
# 1. Install dependencies (from repository root)
npm install

# 2. Initialize environment file (from repository root)
npm run setup:env
# Or locally inside frontend/: cp .env.example .env

# 3. Start development server
npm run dev
```

The Vite development server will start on `http://localhost:5173`.  
The backend API proxy forwards all requests from `/api` directly to `http://localhost:5001`.

## Available Scripts

- `npm run dev` — Starts Vite dev server with Hot Module Replacement (HMR) on port 5173 (strictPort enabled).
- `npm run build` — Compiles TypeScript and builds optimized production bundles to `dist/`.
- `npm run test` — Runs automated component and unit tests with Vitest & Testing Library.
- `npm run preview` — Locally previews production build.
- `npm run lint` — Runs ESLint across `src/`.
- `npm run lint:fix` — Fixes auto-fixable lint issues.
- `npm run format` — Formats source files using Prettier.
- `npm run format:check` — Checks formatting using Prettier.

## Routes Configured

- `/` — Overview Dashboard with high-level KPIs (labeled as mock baseline) and backend connectivity indicator.
- `/inventory` — Inventory management view with dynamic stock status derivation, search filter, and empty states.
- `/sales` — Point of sale transaction history and order records aligned with Prisma schema (monetary values in BDT).
- `/login` — Standalone user authentication skeleton with accessible inputs and role hints.
- `*` (404) — Not Found fallback route rendered in-place (preserving user URL).
