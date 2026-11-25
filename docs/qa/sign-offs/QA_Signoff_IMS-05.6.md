# QA Test Execution & Sign-off Report: IMS-05.6

**Task**: [IMS-05.6] Auth API test cases and run  
**Requirement**: FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-AUTH-04, FR-AUTH-05 (also NFR-SEC-01, NFR-SEC-05)  
**Author / Seat**: QA 2 · Rejwana Tabassum  
**Reviewed by**: QA 1 · Radouan Ahmed  
**Branch**: `feat/IMS-05.6-auth-api-tests`  
**Test Date**: 2026-11-20  
**Environment**: Local · NestJS on PostgreSQL (`inventory_sales_db`) · Vitest 2.1.9 + supertest; the same file runs in the CI job `api-tests`  
**Test file**: `backend/test/auth.api.spec.ts`  
**Overall Verdict (automated suite)**: **PASSED (38/38 tests passing)**

---

## 1. Scope & Objective

This report covers the automated API tests for the authentication tasks IMS-05.1 to IMS-05.5: login, logout and token revocation, access and refresh tokens, the global auth guard and failed-login throttling.

- Test case IDs (`TC-API-nnn`) are the IDs of the test workbook (sheet "Auth API (Sprint 2)"). One test can cover several cases.
- Every test that logs in, locks or deactivates a user uses a throwaway user whose username starts with `qa_auth_`. The users are created in `beforeAll` and deleted in `afterAll`, so the seeded users (sadia, rafi, mitu) and the other API test file are not changed.
- Manual Postman results (cases that cannot be automated) are recorded in the workbook, not in this report.

---

## 2. Test Execution Matrix (38 automated tests)

### IMS-05.1: Login (FR-AUTH-01, FR-AUTH-04)

| Test Case                     | Scenario                                                     | Expected Result                                                              | Actual Result |  Status  |
| :---------------------------- | :----------------------------------------------------------- | :--------------------------------------------------------------------------- | :------------ | :------: |
| **TC-API-001**                | Seeded users sadia, rafi and mitu log in                     | HTTP 200 with role Administrator, Sales Staff and Store Staff                | As expected   | **PASS** |
| **TC-API-008**                | Login response shape                                         | HTTP 200 JSON; user, a 3-part JWT access token, a `smartmart_refresh_` token | As expected   | **PASS** |
| **TC-API-002, 003**           | Upper-case username and upper-case email                     | HTTP 200 for both                                                            | As expected   | **PASS** |
| **TC-API-004**                | Spaces around the username                                   | Trimmed, HTTP 200                                                            | As expected   | **PASS** |
| **TC-API-006**                | Two logins of the same user                                  | Different tokens; both work on `/api/auth/me`                                | As expected   | **PASS** |
| **TC-API-007**                | Login and `/api/auth/me` bodies                              | No `password` and no `argon2` text                                           | As expected   | **PASS** |
| **TC-API-009, 010, 011, 019** | Wrong password, unknown user, short password, trailing space | The same 401 body: `Invalid username or password`, no field named            | As expected   | **PASS** |
| **TC-API-012**                | Deactivated user                                             | The same generic 401                                                         | As expected   | **PASS** |
| **TC-API-013**                | Missing and empty fields                                     | HTTP 400, not 500 (`Username or email is required`)                          | As expected   | **PASS** |
| **TC-API-014**                | Wrong data types (number, boolean, array, object)            | HTTP 400                                                                     | As expected   | **PASS** |
| **TC-API-017**                | GET, PUT, PATCH, DELETE on the login route                   | HTTP 404 or 405, no tokens                                                   | As expected   | **PASS** |
| **TC-API-032**                | Password storage                                             | `password_hash` starts with `$argon2id$`; no row stores the plain password   | As expected   | **PASS** |

### IMS-05.2: Logout and token revocation (FR-AUTH-02)

| Test Case                | Scenario                                                  | Expected Result                                                                        | Actual Result |  Status  |
| :----------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------- | :------------ | :------: |
| **TC-API-037, 038, 039** | Logout, then reuse the access token and the refresh token | Logout 200; `/api/auth/me` 401 "Token has been revoked"; refresh 401; `revoked_at` set | As expected   | **PASS** |
| **TC-API-041**           | Second logout with the same token                         | HTTP 401                                                                               | As expected   | **PASS** |
| **TC-API-042, 043**      | Logout with no token and with a fake token                | HTTP 401 each                                                                          | As expected   | **PASS** |
| **TC-API-044**           | Logout of one user                                        | Another user's token still works                                                       | As expected   | **PASS** |
| **TC-API-045**           | Login again after logout                                  | HTTP 200 and a working token                                                           | As expected   | **PASS** |
| **TC-API-040**           | Two sessions of one user, logout of one (BAQ-S2-05)       | Only that session ends; the other token and refresh token still work                   | As expected   | **PASS** |
| **TC-API-095**           | Logout with only the refresh token in the body            | HTTP 200; the refresh token is rejected afterwards                                     | As expected   | **PASS** |

### IMS-05.3: Access and refresh tokens (FR-AUTH-03, NFR-SEC-05)

| Test Case           | Scenario                                                 | Expected Result                                                                                                                                                    | Actual Result |  Status  |
| :------------------ | :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :------: |
| **TC-API-048**      | Access token claims                                      | `exp - iat` is 900 s; user id, username and role present; no password key                                                                                          | As expected   | **PASS** |
| **TC-API-005**      | Stored refresh token                                     | 64-character hash in the database; not the raw token; lasts 8 hours                                                                                                | As expected   | **PASS** |
| **TC-API-049, 050** | Expired access token on every protected route            | HTTP 401 "Token has expired"                                                                                                                                       | As expected   | **PASS** |
| **TC-API-054, 055** | Valid refresh, then replay of the old refresh token      | 200 with new tokens, new access token works; replay 401 "already been revoked"                                                                                     | As expected   | **PASS** |
| **TC-API-056**      | Access token used as a refresh token                     | HTTP 401                                                                                                                                                           | As expected   | **PASS** |
| **TC-API-057**      | Refresh token used as a Bearer token on protected routes | 401 "Invalid or expired token" on `/api/auth/me`, `/api/categories`, `/api/inventory`, `/api/sales`; access token, `/api/auth/refresh` and logout still return 200 | As expected   | **PASS** |
| **TC-API-058**      | Bad refresh input                                        | Empty body 401 "Refresh token is required"; fake 401; wrong type 400                                                                                               | As expected   | **PASS** |
| **TC-API-051**      | Expired refresh token (`expires_at` in the past)         | HTTP 401 "Refresh token has expired"                                                                                                                               | As expected   | **PASS** |
| **TC-API-059, 071** | User deactivated after login                             | Refresh 401 and the access token 401                                                                                                                               | As expected   | **PASS** |

### IMS-05.5: Auth guard on every route (NFR-SEC-01)

| Test Case       | Scenario                                                          | Expected Result                                                                    | Actual Result |  Status  |
| :-------------- | :---------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :------------ | :------: |
| **TC-API-068**  | `/api/auth/me`, `/api/categories`, `/api/inventory`, `/api/sales` | No token 401 "Authorization header is missing"; `Basic abc` 401; `Bearer fake` 401 | As expected   | **PASS** |
| (public routes) | `/api/health`, login, refresh and logout without a token          | Health 200; login 200; refresh 401 "Refresh token is required"                     | As expected   | **PASS** |
| **TC-API-069**  | Valid access token on every protected route                       | HTTP 200                                                                           | As expected   | **PASS** |
| **TC-API-062**  | Token with an edited payload                                      | HTTP 401 "Invalid token signature"                                                 | As expected   | **PASS** |
| **TC-API-063**  | Edited signature and a token signed with the wrong secret         | HTTP 401 "Invalid token signature"                                                 | As expected   | **PASS** |
| **TC-API-064**  | Unsigned token with `alg: none`                                   | HTTP 401                                                                           | As expected   | **PASS** |
| **TC-API-072**  | Unknown route without a token                                     | HTTP 404, no data                                                                  | As expected   | **PASS** |

### IMS-05.4: Failed-login throttling (FR-AUTH-05)

| Test Case                | Scenario                                         | Expected Result                                                                                                                                                                                                                     | Actual Result |  Status  |
| :----------------------- | :----------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :------: |
| **TC-API-076, 077, 081** | Five wrong passwords, then the right password    | Five 401 with `failed_logins` 1 to 5; then 429 `TEMPORARILY_LOCKED` with `Retry-After` (1 to 900); same answer for a wrong password, for the upper-case email and for other `X-Forwarded-For` values; another account still logs in | As expected   | **PASS** |
| **TC-API-078**           | Four wrong passwords, then the right password    | No lock; 200; `failed_logins` 0, `first_failed_at` and `locked_until` empty                                                                                                                                                         | As expected   | **PASS** |
| **TC-API-079, 080**      | `locked_until` set 120 s ahead, then in the past | 429 with a smaller `Retry-After` one second later; after `locked_until` passes the login returns 200 and the counters reset                                                                                                         | As expected   | **PASS** |

---

## 3. Automated Execution Output

```text
 ✓ test/auth.api.spec.ts (38 tests)

 Test Files  1 passed (1)
      Tests  38 passed (38)
   Duration  4.15s
```

Full API suite (`npm run test:api`, which also runs `test/api.e2e.spec.ts`): 2 files, **55 tests passed**.  
Checks on this branch: Prettier clean for the new files, `npm run lint --workspace=backend` without errors, the test users are removed after the run, and the seeded users keep their original state.

---

## 4. Not Covered by This Suite

| Area                                                      | Where it is handled                                                      |
| :-------------------------------------------------------- | :----------------------------------------------------------------------- |
| Injection, stack traces, logs, headers and CORS           | Security review (IMS-57, IMS-56)                                         |
| Unique salt per user, role checks (403)                   | IMS-07 (user create and role guard are not built yet)                    |
| Per-IP login rate limit (NFR-SEC-07)                      | Waiting for the BA's answer on whether it belongs to IMS-05.4            |
| Screen tests (Sign Out button, session renewal on screen) | Frontend and Playwright work                                             |
| Parallel refresh and parallel logins, migration rollback  | Manual cases in the workbook; they need a runner or a throwaway database |

---

## 5. Conclusion & Handover

- All **38 automated auth API tests** pass against the local database and run with the existing CI job `api-tests` (no workflow change).
- The tests do not change the seeded users or the other API tests.
- Ready for review by **QA 1 · Radouan Ahmed**.
