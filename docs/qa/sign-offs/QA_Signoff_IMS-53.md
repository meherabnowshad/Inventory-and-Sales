# QA Test Execution & Sign-off Report: IMS-53

**Task**: [IMS-53] Automate authentication and role-based API regression  
**Requirements**: FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-USR-04, NFR-SEC-01  
**Author / Seat**: QA 1 · Meherab Hossain Nowshad  
**Reviewed by**: QA 2 · Md Rashadul Islam _(Pending)_  
**Branch**: `fix/IMS-53-review-fixes`  
**Test Date**: 2026-11-27  
**Environment**: Local PostgreSQL (`inventory_sales_db`) & GitHub Actions CI (`api-tests` job against PostgreSQL 16) · Vitest 2.1.9 + supertest  
**Test file**: `backend/test/auth-role-regression.api.spec.ts`  
**Overall Verdict**: **PASSED (32/32 regression tests passing; 137/137 total API tests passing)**

---

## 1. Scope & Acceptance Criteria Coverage

This regression suite fulfills **IMS-53** using the seeded `Administrator` account (`sadia`) and isolated throwaway accounts (`qa_ims53_*`) for `Sales Staff`, `Store Staff`, and the deactivated-user test so it executes safely alongside existing suites (`auth.api.spec.ts`, `api.e2e.spec.ts`, `products.e2e.spec.ts`) in CI on every pull request with zero leftover test users. Dedicated category and product records are created in `beforeAll` and cleaned up in `afterAll`.

| Acceptance Criterion                              | Verification Coverage                                                                                                                                                                                                                                                                |  Status  |
| :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: |
| **Login, refresh, logout lifecycle**              | Full cycle verifying JWT access token, `HttpOnly` `refreshToken` cookie rotation, replay prevention (`401`), and immediate revocation on logout (`401` on both access & refresh tokens).                                                                                             | **PASS** |
| **Role checks on every protected endpoint group** | Parameterized matrix across `/api/health`, `/api/auth/me`, `/api/inventory`, `/api/categories` (`GET`, `GET /:id`, `POST`, `PATCH`, `DELETE`), `/api/products` (`GET /:id`, `POST`, `PATCH`), `/api/sales`, and `/api/users` (`GET`, `GET /:id`, `GET /:id/audit`, `POST`, `PATCH`). | **PASS** |
| **Public `/api/health` access**                   | Explicitly verified `GET /api/health` returns `200` without a token and with an expired token.                                                                                                                                                                                       | **PASS** |
| **Negative: Expired token**                       | Expired JWT access token (`exp` in past) rejected with `401 "Token has expired"` across all 16 protected endpoint combinations.                                                                                                                                                      | **PASS** |
| **Negative: Missing / unauthenticated token**     | Missing `Authorization` header rejected with `401 "Authorization header is missing"` across all 16 protected endpoint combinations.                                                                                                                                                  | **PASS** |
| **Negative: Wrong role**                          | `Sales Staff` blocked (`403 FORBIDDEN_ROLE`) on `/api/categories` writes, `/api/products` writes & `/api/users/*`; `Store Staff` blocked (`403 FORBIDDEN_ROLE`) on `/api/sales` & `/api/users/*`.                                                                                    | **PASS** |
| **Negative: Deactivated user**                    | Deactivating a user via `PATCH /api/users/:id` immediately blocks login (`401`), refresh (`401`), and existing access tokens across all 16 protected endpoint combinations (`401 "Account is deactivated"`).                                                                         | **PASS** |
| **Run in CI on every pull request**               | Automatically discovered and executed by `npm run test:api` (`vitest run test/`) in `.github/workflows/ci.yml` (`api-tests` job).                                                                                                                                                    | **PASS** |

---

## 2. Role & Endpoint Group Regression Matrix

| Endpoint Group                          | Public |   Administrator   | Sales Staff |    Store Staff    | Expired / Missing Token |
| :-------------------------------------- | :----: | :---------------: | :---------: | :---------------: | :---------------------: |
| `GET /api/health`                       | `200`  |       `200`       |    `200`    |       `200`       |     `200` (Public)      |
| `GET /api/auth/me`                      | `401`  |       `200`       |    `200`    |       `200`       |          `401`          |
| `GET /api/inventory`                    | `401`  |       `200`       |    `200`    |       `200`       |          `401`          |
| `GET /api/categories` & `/:id`          | `401`  |       `200`       |    `200`    |       `200`       |          `401`          |
| `POST / PATCH / DELETE /api/categories` | `401`  | `201 / 200 / 204` |    `403`    | `201 / 200 / 204` |          `401`          |
| `GET /api/products/:id`                 | `401`  |       `200`       |    `200`    |       `200`       |          `401`          |
| `POST / PATCH /api/products`            | `401`  |    `201 / 200`    |    `403`    |    `201 / 200`    |          `401`          |
| `GET /api/sales`                        | `401`  |       `200`       |    `200`    |       `403`       |          `401`          |
| `GET / POST / PATCH /api/users*`        | `401`  | `200 / 201 / 200` |    `403`    |       `403`       |          `401`          |

---

## 3. Automated Execution Output

```text
 ✓ test/api.e2e.spec.ts (41)
 ✓ test/auth-role-regression.api.spec.ts (32)
 ✓ test/auth.api.spec.ts (42)
 ✓ test/products.e2e.spec.ts (22)

 Test Files  4 passed (4)
      Tests  137 passed (137)
   Duration  4.01s
```
