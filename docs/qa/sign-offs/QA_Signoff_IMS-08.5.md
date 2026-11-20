# QA Test Execution & Sign-off Report: IMS-08.5

**Task**: [IMS-08.5] Category API test cases  
**Requirement**: FR-CAT-01, FR-CAT-02, FR-CAT-03, FR-CAT-04  
**Author / Seat**: QA 1 · Meherab Hossain Nowshad  
**Reviewed by**: QA 2 · Rejwana Tabassum  
**Branch**: `feat/IMS-08.5-category-api-tests`  
**Test Date**: 2026-11-20  
**Environment**: Local Staging & Automated Vitest Suite / NestJS on PostgreSQL (`inventory_sales_db`)  
**Done When Criteria**: "Cases pass"  
**Overall Verdict**: **PASSED (100% Sign-Off, 29/29 Tests Passing)**

---

## 1. Scope & Objective

Implement comprehensive end-to-end and integration API test coverage for all Category API business rules and functional requirements across **FR-CAT-01 to FR-CAT-04**:

1. **FR-CAT-01 (Create, Read & Field Validation)**: Validation of required name, whitespace trimming, 80-char limit, audit trail `created_by`, and single-item retrieval.
2. **FR-CAT-02 (Unique Category Name - BR-12)**: Case-insensitive unique constraint, whitespace handling, rename conflict prevention, and self-update allowance.
3. **FR-CAT-03 (Deactivate & In-Use Guard)**: Prevention of deleting categories holding active or inactive products (`409 CATEGORY_IN_USE`), safe deletion of unused categories (`204`), and safe deactivation (`200`).
4. **FR-CAT-04 (Product Counts & Status Filter)**: Preserved accurate `productCount` for active, inactive, and mixed product sets, status query filtering (`?status=active|inactive|all`), and query validation.

---

## 2. Test Execution Matrix (24 New Category Tests + 5 Baseline Tests)

### FR-CAT-01: Category Creation, Read & Validation
| Test Case | Scenario | Expected Result | Actual Result | Status |
|:---|:---|:---|:---|:---:|
| **TC-01.1** | Create category with surrounding whitespace | Trimmed name stored, `isActive: true`, 201 Created | Name trimmed, 201 Created | **PASS** |
| **TC-01.2** | Reject empty or whitespace-only name | HTTP 400 Bad Request | HTTP 400 Bad Request | **PASS** |
| **TC-01.3** | Reject name exceeding 80 characters | HTTP 400 Bad Request | HTTP 400 Bad Request | **PASS** |
| **TC-01.4** | Capture `created_by` audit column | PostgreSQL row matches authenticated user ID | ID verified in DB | **PASS** |
| **TC-01.5** | GET `/api/categories/:id` existing ID | HTTP 200 OK with complete category payload | HTTP 200 OK | **PASS** |
| **TC-01.6** | GET `/api/categories/999999` non-existent | HTTP 404 Not Found | HTTP 404 Not Found | **PASS** |

### FR-CAT-02: Unique Category Name Enforcement (BR-12)
| Test Case | Scenario | Expected Result | Actual Result | Status |
|:---|:---|:---|:---|:---:|
| **TC-02.1** | Exact duplicate name submission | HTTP 409 Conflict (`CATEGORY_NAME_TAKEN`) | HTTP 409 Conflict | **PASS** |
| **TC-02.2** | Case-insensitive duplicate submission | HTTP 409 Conflict (`CATEGORY_NAME_TAKEN`) | HTTP 409 Conflict | **PASS** |
| **TC-02.3** | Duplicate with surrounding spaces | HTTP 409 Conflict (`CATEGORY_NAME_TAKEN`) | HTTP 409 Conflict | **PASS** |
| **TC-02.4** | PATCH rename to an existing category | HTTP 409 Conflict (`CATEGORY_NAME_TAKEN`) | HTTP 409 Conflict | **PASS** |
| **TC-02.5** | PATCH category with its own name | HTTP 200 OK (no self-conflict) | HTTP 200 OK | **PASS** |

### FR-CAT-03: Deactivate & In-Use Delete Guard Rules
| Test Case | Scenario | Expected Result | Actual Result | Status |
|:---|:---|:---|:---|:---:|
| **TC-03.1** | Deactivate in-use category via PATCH | HTTP 200 OK, `isActive: false` | HTTP 200 OK | **PASS** |
| **TC-03.2** | DELETE category with active product | HTTP 409 Conflict (`CATEGORY_IN_USE`) | HTTP 409 Conflict | **PASS** |
| **TC-03.3** | DELETE category with inactive product | HTTP 409 Conflict (`CATEGORY_IN_USE`) | HTTP 409 Conflict | **PASS** |
| **TC-03.4** | DELETE unused category | HTTP 204 No Content; record deleted | HTTP 204 No Content | **PASS** |
| **TC-03.5** | DELETE non-existent category ID | HTTP 404 Not Found | HTTP 404 Not Found | **PASS** |

### FR-CAT-04: Product Counts & Status Filtering
| Test Case | Scenario | Expected Result | Actual Result | Status |
|:---|:---|:---|:---|:---:|
| **TC-04.1** | List response contains `productCount` | Every item includes integer `productCount` | Verified on all items | **PASS** |
| **TC-04.2** | Unused category reports `productCount: 0` | Integer 0 returned | Integer 0 returned | **PASS** |
| **TC-04.3** | Combined active + inactive product count | Returns sum of all active and inactive items | Verified (e.g. 3) | **PASS** |
| **TC-04.4** | Query filter `?status=active` | Returns only categories with `isActive === true` | 100% active | **PASS** |
| **TC-04.5** | Query filter `?status=inactive` | Returns only categories with `isActive === false` | 100% inactive | **PASS** |
| **TC-04.6** | Query filter `?status=all` | Returns combined active and inactive categories | Matches default list | **PASS** |
| **TC-04.7** | Query filter `?status=invalid` | HTTP 400 Bad Request with validation message | HTTP 400 Bad Request | **PASS** |
| **TC-04.8** | Alphabetical sorting | Array sorted by `name ASC` | Verified ASC | **PASS** |

---

## 3. Automated Test Execution Evidence

Executed via `npm run test:api` (`backend/test/api.e2e.spec.ts`):

```bash
 RUN  v2.1.9 /Users/nowshad/Inventory and Sales/backend

 ✓ test/api.e2e.spec.ts (29) 428ms
   ✓ API Integration Tests against Test Database (IMS-51.2 | NFR-OPS-01) (29) 428ms
     ✓ Health API (GET /api/health) (1)
     ✓ Authentication Enforcement (IMS-05.5 | NFR-SEC-01) (2)
     ✓ Category API test cases (IMS-08.5 | FR-CAT-01–04) (24)
       ✓ FR-CAT-01: Category Creation, Read & Validation (6)
         ✓ POST /api/categories creates category with trimmed name and default isActive: true
         ✓ POST /api/categories rejects empty or whitespace-only name with 400 Bad Request
         ✓ POST /api/categories rejects name exceeding 80 characters with 400 Bad Request
         ✓ POST /api/categories captures authenticated user ID in database createdBy column
         ✓ GET /api/categories/:id returns the category details
         ✓ GET /api/categories/999999 returns 404 Not Found
       ✓ FR-CAT-02: Unique Category Name Enforcement (BR-12) (5)
         ✓ POST /api/categories rejects duplicate category name with 409 CATEGORY_NAME_TAKEN
         ✓ POST /api/categories rejects duplicate category name case-insensitively with 409
         ✓ POST /api/categories rejects duplicate category name with surrounding whitespace with 409
         ✓ PATCH /api/categories/:id rejects renaming to an existing category name with 409
         ✓ PATCH /api/categories/:id allows updating fields without changing name (no self-conflict)
       ✓ FR-CAT-03: Deactivate & In-Use Delete Guard Rules (5)
         ✓ deactivating an in-use category is allowed (200 OK)
         ✓ deleting a category with an active product returns 409 CATEGORY_IN_USE
         ✓ deleting a category with only an inactive product returns 409 CATEGORY_IN_USE
         ✓ deleting an unused category returns 204 and category is removed
         ✓ deleting a non-existent category returns 404
       ✓ FR-CAT-04: Product Counts & Status Filtering (8)
         ✓ GET /api/categories returns productCount for every category
         ✓ GET /api/categories includes productCount: 0 for categories with no products
         ✓ GET /api/categories includes both active and inactive products in productCount
         ✓ GET /api/categories?status=active returns only active categories
         ✓ GET /api/categories?status=inactive returns only inactive categories
         ✓ GET /api/categories?status=all returns all categories regardless of active status
         ✓ GET /api/categories?status=invalid returns 400 Bad Request
         ✓ GET /api/categories returns categories sorted alphabetically by name ASC
     ✓ Inventory API (GET /api/inventory) (1)
     ✓ Sales API (GET /api/sales) (1)

 Test Files  1 passed (1)
      Tests  29 passed (29)
   Duration  1.46s
```

---

## 4. Conclusion & Handover

- **All 24 Category API test cases** pass cleanly with 100% assertion coverage.
- Code style and linting verified with Prettier and ESLint.
- Ready for review by **QA 2 · Rejwana Tabassum**.
