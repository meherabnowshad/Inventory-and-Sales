# QA Test Execution & Sign-off Report: IMS-08.4

**Task**: [IMS-08.4] Product counts in the list endpoint  
**Requirement**: FR-CAT-04 (Categories API: Product Counts & Filter)  
**Developer**: Md. Rashadul Islam (Dev 1)  
**Tested by**: MD Meherab Hossain Nowshad (Dev 2 / QA 1)  
**Test Date**: 2026-11-20  
**Environment**: Local Staging / NestJS 10 on PostgreSQL (`inventory_sales_db`)  
**Branch / Commit**: `feat/IMS-08.4-category-product-counts` (`3513aba`) merged into `master` (`832d757`)  
**Done When Criteria**: "Counts correct"  
**Overall Verdict**: **PASSED (100% Sign-Off)**

---

## 1. Scope & Acceptance Criteria

| Criteria ID | Specification | Done-When Validation | Result |
| :--- | :--- | :--- | :--- |
| **AC-01** | `productCount` field included | Every category object in `GET /api/categories` contains `productCount: number` | **PASSED** |
| **AC-02** | Zero product category | Categories with 0 linked products return `productCount: 0` | **PASSED** |
| **AC-03** | Active product count | Categories with active products accurately report the count of active items | **PASSED** |
| **AC-04** | Inactive product count (BR-11) | Categories with inactive products (`is_active = false`) count inactive items | **PASSED** |
| **AC-05** | Combined active + inactive count | Category with mixed active and inactive items returns total sum (`active + inactive`) | **PASSED** |
| **AC-06** | Status query filter | `?status=active`, `?status=inactive`, `?status=all` filters categories while retaining counts | **PASSED** |
| **AC-07** | Query param validation | Invalid status query (e.g. `?status=invalid`) rejected with `400 Bad Request` | **PASSED** |
| **AC-08** | Alphabetical sorting | Categories in list response ordered by `name ASC` | **PASSED** |

---

## 2. Test Execution Matrix

| Test Case ID | Test Scenario | Request Details | Expected Status / Value | Actual Status / Value | Result |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-PCNT-01** | Zero product count | `GET /api/categories` for newly created category with 0 products | `productCount: 0` | `productCount: 0` | **PASS** |
| **TC-PCNT-02** | Active products count | `GET /api/categories` for `Keyboards` (1 active product) | `productCount: 1` | `productCount: 1` | **PASS** |
| **TC-PCNT-03** | Inactive products inclusion | `GET /api/categories` with category holding inactive product | `productCount` includes inactive product | `productCount: 1` | **PASS** |
| **TC-PCNT-04** | Mixed products count | Category with 2 active and 1 inactive products | `productCount: 3` | `productCount: 3` | **PASS** |
| **TC-PCNT-05** | Filter `?status=active` | `GET /api/categories?status=active` | All returned items have `isActive: true` | 100% match (`isActive: true`) | **PASS** |
| **TC-PCNT-06** | Filter `?status=inactive` | `GET /api/categories?status=inactive` | All returned items have `isActive: false` | 100% match (`isActive: false`) | **PASS** |
| **TC-PCNT-07** | Filter `?status=all` | `GET /api/categories?status=all` | Total returned = active count + inactive count | Total = 8 (5 active + 3 inactive) | **PASS** |
| **TC-PCNT-08** | Status query validation | `GET /api/categories?status=invalid` | `400 Bad Request` (`IsIn` validation) | `400 Bad Request` | **PASS** |
| **TC-PCNT-09** | Alphabetical sorting | `GET /api/categories` | Array sorted by `name ASC` | Sorted: Cables, Keyboards, Mice... | **PASS** |
| **TC-PCNT-10** | Auth enforcement | `GET /api/categories` with no auth header | `401 Unauthorized` | `401 Unauthorized` | **PASS** |

---

## 3. Automated Test Evidence

### Backend API Integration Suite (`backend/test/api.e2e.spec.ts`)
```bash
 RUN  v2.1.9 /Users/nowshad/Inventory and Sales/backend

 ✓ test/api.e2e.spec.ts (16)
   ✓ API Integration Tests against Test Database (IMS-51.2 | NFR-OPS-01) (16)
     ✓ Health API (GET /api/health) (1)
     ✓ Authentication Enforcement (IMS-05.5 | NFR-SEC-01) (2)
     ✓ Categories API (/api/categories) (5)
       ✓ GET /api/categories returns seeded categories sorted by name
       ✓ POST /api/categories creates a new category in the database
       ✓ GET /api/categories/:id returns the created category
       ✓ PATCH /api/categories/:id updates the category details
       ✓ GET /api/categories/999999 returns 404 Not Found
     ✓ Category delete and deactivate rules (IMS-08.3 | FR-CAT-03) (6)
       ✓ deactivating a category that products use is allowed (200)
       ✓ deleting a category with an active product returns 409 CATEGORY_IN_USE
       ✓ deleting a category with only an inactive product returns 409 CATEGORY_IN_USE
       ✓ deleting an unused category returns 204 and the category is gone
       ✓ deleting a category that does not exist returns 404
       ✓ productCount in the list includes inactive products (IMS-08.4)
     ✓ Inventory API (GET /api/inventory) (1)
     ✓ Sales API (GET /api/sales) (1)

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  1.24s
```

### Frontend Component & UI Suite (`npm run test:frontend`)
```bash
 Test Files  9 passed (9)
      Tests  55 passed (55)
   Duration  4.40s
```
*(Including `CategoriesPage (IMS-09.1 / FR-CAT-04)`: "shows each category with its product count and status" and "loads all categories first, then asks the API for inactive ones when the filter changes").*

---

## 4. Live API & Database Verification Logs

### TC-PCNT-01: Zero Count Verification
- **Category Created**: ID `46` (`QA Zero Prod Cat`)
- **Query**: `GET /api/categories`
- **Extracted Row**:
```json
{
  "id": 46,
  "name": "QA Zero Prod Cat",
  "description": "Zero count test",
  "isActive": true,
  "productCount": 0
}
```

### TC-PCNT-04: Active + Inactive Mixed Verification
- **Category Created**: ID `47` (`QA Mixed Prod Cat`)
- **Products Inserted**:
  - `Prod Active 1` (`is_active = true`)
  - `Prod Active 2` (`is_active = true`)
  - `Prod Inactive 1` (`is_active = false`)
- **Query**: `GET /api/categories`
- **Extracted Row**:
```json
{
  "id": 47,
  "name": "QA Mixed Prod Cat",
  "description": "Mixed count test",
  "isActive": true,
  "productCount": 3
}
```
**Conclusion**: Accurately counts 3 items (2 active + 1 inactive), satisfying business rule BR-11 and FR-CAT-04.

### TC-PCNT-08: Status Query DTO Validation
- **Request**: `GET /api/categories?status=invalid`
- **Response**: `HTTP 400 Bad Request`
```json
{
  "message": [
    "status must be one of the following values: active, inactive, all"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

---

## 5. Sign-off Conclusion

All test scenarios confirm:
1. Product counts are 100% accurate across zero, active, inactive, and mixed product configurations.
2. Inactive products are not dropped from `productCount`, safeguarding inventory awareness.
3. Filtering via `?status=active|inactive|all` is validated and functions as designed.
4. Alphabetical ordering and authentication guards operate as expected.

**Done-When criteria ("Counts correct") is verified. IMS-08.4 is approved for QA sign-off.**
