# Frontend Application — Inventory and Sales Management System

Subtask: **IMS-03.2**  
Non-Functional Requirements covered: **NFR-SEC-03**, **NFR-MNT-01**, **NFR-OPS-01**

## Overview

React 18 single-page application built with Vite, TypeScript, Tailwind CSS, Lucide icons, Vitest + React Testing Library, and React Router v6.

## Setup

Use the repository's [README](../README.md) as the single setup guide for the frontend, backend, and PostgreSQL database. The frontend can also run independently; from the repository root, run `npm install`, `npm run setup:env`, then `npm run dev:frontend`.

## Frontend scripts

Run these commands from the repository root with `--workspace=frontend`, or from `frontend/` without the workspace option.

- `npm run dev` — Starts Vite with Hot Module Replacement.
- `npm run build` — Type-checks and builds optimized production assets.
- `npm run test` — Runs Vitest component and unit tests.
- `npm run preview` — Previews the production build.
- `npm run lint` — Runs ESLint on `src/`.
- `npm run format` — Formats frontend source files with Prettier.
- `npm run format:check` — Checks formatting without changing files.

## Routes

- `/` — Overview dashboard with baseline KPIs and backend connectivity indicator.
- `/inventory` — Inventory view with stock status, search, and empty states.
- `/sales` — Sales transaction history.
- `/login` — Authentication skeleton.
- `*` — Not Found fallback.
