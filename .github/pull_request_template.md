## 📌 Description & Context

<!-- Provide a concise summary of the changes made and the motivation behind them. -->

## 🎯 Linked SRS / Jira Subtask

- **Subtask ID:** IMS-
- **SRS Reference:** Group 1 SRS (Sprint 1)
- **Assignee:** Meherab (Dev 2)

---

## 🛠 Type of Change

- [ ] 🚀 New Feature (non-breaking change which adds functionality)
- [ ] 🐛 Bug Fix (non-breaking change which fixes an issue)
- [ ] 🧹 Refactoring / Code Style (no functional change)
- [ ] 📝 Documentation Update
- [ ] ⚙️ CI/CD / DevOps / Infrastructure
- [ ] 🔒 Security / Compliance Fix

---

## 🛡️ Non-Functional Requirements (NFR) Checklist

Ensure the change satisfies the project NFRs before requesting review:

- [ ] **NFR-SEC-03 (Security & Secret Isolation)**:
  - No secrets, API keys, passwords, or `.env` files are committed.
  - If new environment variables are introduced, `.env.example` in `backend/` or `frontend/` has been updated with safe placeholders and explanatory comments.
- [ ] **NFR-MNT-01 (Maintainability & Code Standards)**:
  - Code follows ESLint rules with 0 errors (`npm run lint`).
  - Code is formatted cleanly with Prettier (`npm run format:check`).
  - TypeScript types are properly defined (avoid unnecessary `any`).
- [ ] **NFR-OPS-01 (Operational Reliability & Single-Command Startup)**:
  - Verified local startup with one command (`npm run dev`, `npm run dev:backend`, or `npm run dev:frontend`).
  - Health check endpoint `/api/health` returns status `UP` (200 OK).

---

## 🧪 Testing Performed

<!-- Describe the manual or automated tests you performed to verify your changes. -->

1. [ ] Started backend (`npm run dev:backend`) and confirmed health check at `http://localhost:5000/api/health`.
2. [ ] Started frontend (`npm run dev:frontend`) and verified UI at `http://localhost:5173`.
3. [ ] Executed linter: `npm run lint` — passed without errors.
4. [ ] Executed formatter check: `npm run format:check` — passed without errors.
5. [ ] Verified build: `npm run build` — compiled successfully.

---

## 👥 Reviewer Checklist

> **Branch Protection Policy:** Merging into `main` requires at least **1 peer approval** and all CI status checks passing.

- [ ] Code logic is clean, understandable, and adheres to modular boundaries.
- [ ] No regression introduced to existing endpoints or frontend views.
- [ ] PR is ready to merge into `main`.
