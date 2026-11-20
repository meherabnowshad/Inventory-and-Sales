# QA Test Execution & Sign-off Report: IMS-08.3

**Task**: [IMS-08.3] Deactivate with in-use guard  
**Requirement**: FR-CAT-03  
**Developer**: Md. Rashadul Islam (Dev 1)  
**Tested by**: Meherab Hossain Nowshad (QA 1)  
**Test Date**: 2026-11-20  
**Environment**: Local Staging / Backend NestJS on PostgreSQL (`inventory_sales_db`)  
**Commit / PR Tested**: PR #30 (`feat(categories): in-use delete guard (IMS-08.3 | FR-CAT-03)`) merged into `master` (`832d757`)  
**Overall Verdict**: **PASSED (100% Sign-Off)**

---

## 1. Scope & Acceptance Criteria

| ID | Criteria | Specification | Result |
| :--- | :--- | :--- | :--- |
| **AC-01** | Unused Category Deletion | Category with 0 products can be deleted cleanly (`HTTP 204`) | **PASSED** |
| **AC-02** | In-Use Delete Guard (Active) | Category with active products returns `HTTP 409 CATEGORY_IN_USE` with message & `productCount` | **PASSED** |
| **AC-03** | In-Use Delete Guard (Inactive) | Category with inactive products also returns `HTTP 409 CATEGORY_IN_USE` | **PASSED** |
| **AC-04** | Deactivation Permission | Deactivating an in-use category via `PATCH` is permitted (`HTTP 200`) per BA Option A | **PASSED** |
| **AC-05** | Non-Existent ID Handling | Deleting non-existent ID returns `HTTP 404 Not Found` | **PASSED** |
| **AC-06** | Audit Trail Integrity | Authenticated user ID is saved into `created_by` on category creation | **PASSED** |

---

## 2. Test Execution Matrix

| Test Case ID | Test Scenario | Request Details | Expected Status / Body | Actual Status / Response | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-CAT-01** | Delete unused category | `DELETE /api/categories/:id` (empty category) | `204 No Content`, subsequent `GET` gives `404` | `204 No Content` / `GET` returned `404` | **PASS** |
| **TC-CAT-02** | Delete in-use category (active product) | `DELETE /api/categories/1` | `409 Conflict`, code `CATEGORY_IN_USE`, `productCount: 1` | `409 Conflict`, code `CATEGORY_IN_USE`, `productCount: 1` | **PASS** |
| **TC-CAT-03** | Delete in-use category (inactive product) | `DELETE /api/categories/:id` with product `is_active = false` | `409 Conflict`, code `CATEGORY_IN_USE` | `409 Conflict`, code `CATEGORY_IN_USE`, `productCount: 1` | **PASS** |
| **TC-CAT-04** | Deactivate in-use category | `PATCH /api/categories/1` `{"isActive": false}` | `200 OK`, `isActive: false` | `200 OK`, `isActive: false` | **PASS** |
| **TC-CAT-05** | Delete non-existent category | `DELETE /api/categories/999999` | `404 Not Found` | `404 Not Found`, message `Category 999999 not found` | **PASS** |
| **TC-CAT-06** | Audit Trail (`created_by`) | `POST /api/categories` authenticated as `mitu` (User ID 3) | `categories.created_by == 3` in PostgreSQL | DB row `created_by = 3` verified | **PASS** |

---

## 3. Automated Test Evidence

Automated Vitest E2E Suite executed via `npm run test:api`:

```bash
 RUN  v2.1.9 /Users/nowshad/Inventory and Sales/backend

 ✓ test/api.e2e.spec.ts (16)
   ✓ API Integration Tests against Test Database (IMS-51.2 | NFR-OPS-01) (16)
     ✓ Health API (GET /api/health) (1)
     ✓ Authentication Enforcement (IMS-05.5 | NFR-SEC-01) (2)
     ✓ Categories API (/api/categories) (5)
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
   Duration  1.07s
```

---

## 4. Live API & Database Verification Logs

### TC-CAT-01: Delete Unused Category
- **Request**: `POST /api/categories` -> Created ID `41`
- **Request**: `DELETE /api/categories/41`
- **Response Status**: `204 No Content`
- **Verification**: `GET /api/categories/41` -> `404 Not Found`

### TC-CAT-02: Delete In-Use Category (Active Product)
- **Request**: `DELETE /api/categories/1`
- **Response Status**: `409 Conflict`
- **Response Payload**:
```json
{
  "code": "CATEGORY_IN_USE",
  "message": "This category is used by 1 product(s) and cannot be deleted. Deactivate it instead.",
  "productCount": 1
}
```

### TC-CAT-03: Delete In-Use Category (Inactive Product)
- **Setup**: Created category ID `43`, inserted linked product with `is_active = false`.
- **Request**: `DELETE /api/categories/43`
- **Response Status**: `409 Conflict`
- **Response Payload**:
```json
{
  "code": "CATEGORY_IN_USE",
  "message": "This category is used by 1 product(s) and cannot be deleted. Deactivate it instead.",
  "productCount": 1
}
```

### TC-CAT-04: Deactivate In-Use Category
- **Request**: `PATCH /api/categories/1` with `{"isActive": false}`
- **Response Status**: `200 OK`
- **Payload Verification**: `{"id": 1, "name": "Keyboards", "isActive": false, ...}`
- **Restoration**: Returned to `isActive: true` successfully.

### TC-CAT-05: Non-Existent ID
- **Request**: `DELETE /api/categories/999999`
- **Response Status**: `404 Not Found`
- **Response Payload**:
```json
{
  "message": "Category 999999 not found",
  "error": "Not Found",
  "statusCode": 404
}
```

### TC-CAT-06: Database Audit Trail (`created_by`)
- **Action**: Authenticated as user `mitu` (Role: Store Keeper, ID: 3) and created category.
- **Database Query**: `SELECT id, name, created_by, is_active FROM categories WHERE id = 44;`
- **Result**:
```
 id |         name         | created_by | is_active 
----+----------------------+------------+-----------
 44 | QA Mitu Audit Cat 06 |          3 | t
```
Audit field is correctly populated from JWT session context.

---

## 5. Sign-off Conclusion

All 6 test scenarios specified in FR-CAT-03 behave strictly according to requirements:
- In-use categories are protected from accidental deletion whether linked products are active or archived.
- Helpful guidance (`Deactivate it instead.`) and `productCount` are included in the error payload.
- Safe deactivation remains fully functional.
- Audit trail integrity (`created_by`) is maintained.

**IMS-08.3 is approved for QA sign-off.**
