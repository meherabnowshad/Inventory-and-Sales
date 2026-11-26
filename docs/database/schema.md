# SmartMart Database Schema

|              |                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tasks**    | IMS-02.2 Keys, unique indexes, checks and foreign keys · IMS-02.3 Stock movement ledger and audit log · IMS-02.4 BA review changes (users throttle columns, `idempotency_keys`, phone rule) |
| **Parent**   | IMS-02 Design relational database schema and data integrity rules                                                                                                                           |
| **Author**   | Dev 1 · Md. Rashadul Islam                                                                                                                                                                  |
| **Reviewer** | Dev 2 · MD Meherab Hossain Nowshad                                                                                                                                                          |
| **Tester**   | QA 1 · Radouan Ahmed (IMS-02.5)                                                                                                                                                             |
| **Source**   | SRS Group 1 (SmartMart) — main SRS section 5 "Data requirements", section 6 "Business rules", validation rules; engineering spec v0.3 section 3 "PostgreSQL DDL"                            |
| **Covers**   | BR-01, BR-12, FR-INV-08 (02.2) · FR-INV-03, FR-AUD-01 (02.3)                                                                                                                                |
| **Database** | PostgreSQL 16                                                                                                                                                                               |
| **Status**   | BA review answered 11 Nov 2026. Changes applied in migrations 20261111000000, 20261111000100 and 20261111000200; waiting for BA re-validation (IMS-02.4)                                    |

ER diagram: [erd.md](./erd.md) · [erd.dbml](./erd.dbml) · [erd.png](./erd.png)

---

## 1. Conventions

These apply to every table unless the table section says otherwise.

| Topic                   | Rule                                                                                                                                                                                                                                                                                                                                | Source                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Primary keys            | Surrogate `id`, `BIGSERIAL` (`SERIAL` / `SMALLSERIAL` for small lookup tables)                                                                                                                                                                                                                                                      | DDL                              |
| Money                   | `NUMERIC(12,2)`, range 0 to 9,999,999.99, BDT. Never `FLOAT` / `REAL`                                                                                                                                                                                                                                                               | BR-13, NFR-REL-03                |
| Quantities              | `INTEGER`, whole numbers, `> 0` on document lines                                                                                                                                                                                                                                                                                   | Validation rules                 |
| Text                    | Required text is trimmed and not empty: `CHECK (btrim(col) <> '')`. Names are at most 120 characters                                                                                                                                                                                                                                | Validation rules                 |
| Phone                   | `CHAR(11)`, Bangladesh mobile format: `CHECK (phone ~ '^01[0-9]{9}$')`                                                                                                                                                                                                                                                              | Validation rules (SRS section 6) |
| Case-insensitive unique | Unique index on `lower(col)`, not a plain `UNIQUE`                                                                                                                                                                                                                                                                                  | BR-12, FR-CAT-01                 |
| Audit columns           | Every business table has `created_at`, `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`) and `created_by` (`BIGINT NOT NULL → users.id`). Line tables (`purchase_order_lines`, `sales_invoice_lines`, `sales_return_lines`) are only written together with their header, so they take who and when from the header, as in the DDL | Section 5                        |
| Deletion                | No hard delete for anything that appears in history. Master data uses `is_active`; documents use a `CANCELLED` status                                                                                                                                                                                                               | BR-14                            |
| Foreign keys            | `ON DELETE RESTRICT` by default. `ON DELETE CASCADE` only from a document header to its own lines                                                                                                                                                                                                                                   | DDL                              |
| FK indexes              | PostgreSQL does not index foreign keys automatically, so every FK used in a lookup gets an index                                                                                                                                                                                                                                    | Performance (NFR-PERF-01)        |
| Constraint names        | `<table>_<column>_<rule>`, e.g. `products_stock_qty_nonneg`, so a failing test or API error can name the rule                                                                                                                                                                                                                       | Team convention                  |

**Key legend used below:** PK = primary key · FK = foreign key · UQ = unique · CK = check · NN = not null

---

## 2. Tables (14 + 1 helper)

### 2.1 `roles`

Lookup table with a fixed list. Seeded by the first migration; the API never edits it.

| Column | Type          | Null | Rule                                                           |
| ------ | ------------- | ---- | -------------------------------------------------------------- |
| `id`   | `SMALLSERIAL` | NN   | PK                                                             |
| `name` | `VARCHAR(40)` | NN   | UQ; CK `name IN ('Administrator','Sales Staff','Store Staff')` |

Seed rows: `Administrator`, `Sales Staff`, `Store Staff`.

> Review point: the engineering DDL replaces this table with an enum `user_role` on `users.role`. See section 6.

---

### 2.2 `users`

| Column                     | Type           | Null | Rule                                                                     |
| -------------------------- | -------------- | ---- | ------------------------------------------------------------------------ |
| `id`                       | `BIGSERIAL`    | NN   | PK                                                                       |
| `name`                     | `VARCHAR(120)` | NN   | CK not empty                                                             |
| `username`                 | `VARCHAR(40)`  | NN   | UQ on `lower(username)`                                                  |
| `email`                    | `VARCHAR(254)` | NN   | UQ on `lower(email)`                                                     |
| `password_hash`            | `TEXT`         | NN   | Argon2id hash, never the plain password (FR-AUTH-04)                     |
| `must_reset_pw`            | `BOOLEAN`      | NN   | default `FALSE`; staff must change a temporary password on next login    |
| `role_id`                  | `SMALLINT`     | NN   | FK → `roles.id` RESTRICT                                                 |
| `is_active`                | `BOOLEAN`      | NN   | default `TRUE`                                                           |
| `failed_logins`            | `INTEGER`      | NN   | default `0`; CK `>= 0`. Failed logins in the current window (FR-AUTH-05) |
| `first_failed_at`          | `TIMESTAMPTZ`  | NULL | start of the current 15-minute window                                    |
| `locked_until`             | `TIMESTAMPTZ`  | NULL | login refused until this time; NULL = not locked                         |
| `created_at`, `updated_at` | `TIMESTAMPTZ`  | NN   | default `now()`                                                          |
| `created_by`               | `BIGINT`       | NULL | FK → `users.id`. NULL only for the first seeded administrator            |

```sql
CREATE UNIQUE INDEX users_username_ci ON users (lower(username));
CREATE UNIQUE INDEX users_email_ci    ON users (lower(email));
CREATE INDEX        users_role_id_idx ON users (role_id);
ALTER TABLE users
  ADD CONSTRAINT users_failed_logins_check CHECK (failed_logins >= 0);   -- IMS-02.4
```

The three throttle columns serve FR-AUTH-05 (5 failures in 15 minutes, then a 15-minute wait). The login code (IMS-05.4) counts failures from `first_failed_at`, sets `locked_until` on the fifth, and resets all three (`0`, `NULL`, `NULL`) after a successful login. Added by migration `20261111000000_users_login_throttle` (BA decision, point 4).

---

### 2.3 `categories`

| Column        | Type           | Null | Rule                                          |
| ------------- | -------------- | ---- | --------------------------------------------- |
| `id`          | `SERIAL`       | NN   | PK                                            |
| `name`        | `VARCHAR(80)`  | NN   | UQ on `lower(name)` (FR-CAT-01); CK not empty |
| `description` | `VARCHAR(255)` | NULL |                                               |
| `is_active`   | `BOOLEAN`      | NN   | default `TRUE`                                |
| audit columns |                | NN   | see conventions                               |

```sql
CREATE UNIQUE INDEX categories_name_ci ON categories (lower(name));
```

A category with products cannot be deleted, only deactivated (FR-CAT-03). The RESTRICT FK from `products` enforces this in the database.

---

### 2.4 `products`

| Column           | Type            | Null | Rule                                                                        |
| ---------------- | --------------- | ---- | --------------------------------------------------------------------------- |
| `id`             | `BIGSERIAL`     | NN   | PK                                                                          |
| `sku`            | `VARCHAR(40)`   | NN   | UQ on `lower(sku)` (**BR-12**); locked after the first movement (**BR-12**) |
| `name`           | `VARCHAR(120)`  | NN   | CK not empty                                                                |
| `category_id`    | `INTEGER`       | NN   | FK → `categories.id` RESTRICT                                               |
| `purchase_price` | `NUMERIC(12,2)` | NN   | CK `BETWEEN 0 AND 9999999.99`                                               |
| `selling_price`  | `NUMERIC(12,2)` | NN   | CK `BETWEEN 0 AND 9999999.99`                                               |
| `min_stock`      | `INTEGER`       | NN   | default `0`; CK `>= 0`                                                      |
| `stock_qty`      | `INTEGER`       | NN   | default `0`; CK `>= 0` (**BR-01, FR-INV-08**)                               |
| `is_active`      | `BOOLEAN`       | NN   | default `TRUE`                                                              |
| audit columns    |                 | NN   | see conventions                                                             |

```sql
ALTER TABLE products
  ADD CONSTRAINT products_stock_qty_nonneg CHECK (stock_qty >= 0);   -- BR-01, FR-INV-08

CREATE UNIQUE INDEX products_sku_ci      ON products (lower(sku));   -- BR-12
CREATE INDEX        products_category_idx ON products (category_id);
CREATE INDEX        products_low_stock    ON products (category_id)
  WHERE stock_qty < min_stock;                                       -- BR-10, FR-INV-07
```

**SKU lock (BR-12, second half).** The SRS says "unique index and update check". The update check lives in the product service (IMS-10): reject a SKU change with `409` when the product has any `stock_movements` row. Proposed second layer in the database:

```sql
CREATE FUNCTION products_sku_locked() RETURNS trigger AS $$
BEGIN
  IF NEW.sku IS DISTINCT FROM OLD.sku
     AND EXISTS (SELECT 1 FROM stock_movements WHERE product_id = OLD.id) THEN
    RAISE EXCEPTION 'SKU is locked after the first stock movement (BR-12)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER products_sku_locked
  BEFORE UPDATE OF sku ON products
  FOR EACH ROW EXECUTE FUNCTION products_sku_locked();
```

**Never negative (FR-INV-08) — two layers.**

| Layer    | How                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database | `products_stock_qty_nonneg` CHECK above, plus `stock_before >= 0` and `stock_after >= 0` on `stock_movements`                                            |
| Code     | Stock service locks product rows (`SELECT … FOR UPDATE`, ascending `id`) and checks the new quantity before the update; returns `422 INSUFFICIENT_STOCK` |

`stock_qty` is never updated directly. It changes only inside the stock transaction in section 3.

---

### 2.5 `suppliers`

| Column           | Type           | Null | Rule                        |
| ---------------- | -------------- | ---- | --------------------------- |
| `id`             | `BIGSERIAL`    | NN   | PK                          |
| `name`           | `VARCHAR(120)` | NN   | CK not empty (FR-SUP-01)    |
| `contact_person` | `VARCHAR(120)` | NULL |                             |
| `phone`          | `CHAR(11)`     | NN   | CK phone format (FR-SUP-01) |
| `email`          | `VARCHAR(254)` | NULL | format checked in the API   |
| `address`        | `VARCHAR(255)` | NULL |                             |
| `is_active`      | `BOOLEAN`      | NN   | default `TRUE`              |
| audit columns    |                | NN   | see conventions             |

An inactive supplier cannot receive a new purchase order (BR-11). This is a service check on create, because it depends on the row's current state.

The `/api/suppliers` endpoints support supplier creation, listing, viewing, updating, and deactivation.

---

### 2.6 `customers`

| Column        | Type           | Null | Rule                            |
| ------------- | -------------- | ---- | ------------------------------- |
| `id`          | `BIGSERIAL`    | NN   | PK                              |
| `name`        | `VARCHAR(120)` | NN   | CK not empty                    |
| `phone`       | `CHAR(11)`     | NULL | UQ (FR-CUS-01); CK phone format |
| `email`       | `VARCHAR(254)` | NULL |                                 |
| `address`     | `VARCHAR(255)` | NULL |                                 |
| `is_walk_in`  | `BOOLEAN`      | NN   | default `FALSE`                 |
| `is_active`   | `BOOLEAN`      | NN   | default `TRUE`                  |
| audit columns |                | NN   | see conventions                 |

```sql
ALTER TABLE customers
  ADD CONSTRAINT customers_phone_required CHECK (is_walk_in OR phone IS NOT NULL);

CREATE UNIQUE INDEX customers_one_walk_in ON customers (is_walk_in) WHERE is_walk_in;  -- FR-CUS-03
```

The single walk-in row is seeded after the first administrator, so its `created_by` can point to that user.

---

### 2.7 `purchase_orders`

| Column          | Type            | Null | Rule                                                                             |
| --------------- | --------------- | ---- | -------------------------------------------------------------------------------- |
| `id`            | `BIGSERIAL`     | NN   | PK                                                                               |
| `po_number`     | `CHAR(14)`      | NN   | UQ; format `PO-2026-000045` (Q20 default)                                        |
| `supplier_id`   | `BIGINT`        | NN   | FK → `suppliers.id` RESTRICT                                                     |
| `status`        | `VARCHAR(10)`   | NN   | default `'DRAFT'`; CK `IN ('DRAFT','ORDERED','RECEIVED','CANCELLED')` (FR-PO-04) |
| `order_date`    | `DATE`          | NN   |                                                                                  |
| `expected_date` | `DATE`          | NULL |                                                                                  |
| `total`         | `NUMERIC(12,2)` | NN   | default `0`; CK `>= 0`; sum of line totals (FR-PO-02)                            |
| `received_by`   | `BIGINT`        | NULL | FK → `users.id`                                                                  |
| `received_at`   | `TIMESTAMPTZ`   | NULL |                                                                                  |
| audit columns   |                 | NN   | see conventions                                                                  |

```sql
-- One CHECK per column (IMS-02.5 Bug 1, migration 20261112000000_po_received_checks).
-- A single CHECK on both columns let a DRAFT order keep only received_at or only received_by.
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_received_at_consistent
    CHECK ((status = 'RECEIVED') = (received_at IS NOT NULL)),
  ADD CONSTRAINT purchase_orders_received_by_consistent
    CHECK ((status = 'RECEIVED') = (received_by IS NOT NULL));

CREATE INDEX purchase_orders_supplier_idx ON purchase_orders (supplier_id);
CREATE INDEX purchase_orders_status_date  ON purchase_orders (status, order_date DESC);  -- FR-PO-07
```

Received once only (BR-03): the receive transaction locks the PO row and checks `status = 'ORDERED'` before changing anything.

---

### 2.8 `purchase_order_lines`

| Column       | Type            | Null | Rule                                                |
| ------------ | --------------- | ---- | --------------------------------------------------- |
| `id`         | `BIGSERIAL`     | NN   | PK                                                  |
| `po_id`      | `BIGINT`        | NN   | FK → `purchase_orders.id` CASCADE                   |
| `product_id` | `BIGINT`        | NN   | FK → `products.id` RESTRICT                         |
| `quantity`   | `INTEGER`       | NN   | CK `> 0`                                            |
| `unit_cost`  | `NUMERIC(12,2)` | NN   | CK `BETWEEN 0 AND 9999999.99`                       |
| `line_total` | `NUMERIC(12,2)` |      | `GENERATED ALWAYS AS (quantity * unit_cost) STORED` |

```sql
ALTER TABLE purchase_order_lines
  ADD CONSTRAINT po_lines_one_per_product UNIQUE (po_id, product_id);
CREATE INDEX po_lines_product_idx ON purchase_order_lines (product_id);
```

---

### 2.9 `sales_invoices`

| Column            | Type            | Null | Rule                                                                      |
| ----------------- | --------------- | ---- | ------------------------------------------------------------------------- |
| `id`              | `BIGSERIAL`     | NN   | PK                                                                        |
| `invoice_number`  | `CHAR(15)`      | NULL | UQ; set at confirm from `invoice_seq`, e.g. `INV-2026-000123` (FR-SAL-08) |
| `customer_id`     | `BIGINT`        | NN   | FK → `customers.id` RESTRICT                                              |
| `status`          | `VARCHAR(10)`   | NN   | default `'DRAFT'`; CK `IN ('DRAFT','CONFIRMED','CANCELLED')`              |
| `total`           | `NUMERIC(12,2)` | NN   | default `0`; CK `>= 0`                                                    |
| `payment_method`  | `VARCHAR(15)`   | NULL | CK `IN ('CASH','CARD','MOBILE_BANKING')` (Q7)                             |
| `confirmed_by`    | `BIGINT`        | NULL | FK → `users.id`                                                           |
| `confirmed_at`    | `TIMESTAMPTZ`   | NULL |                                                                           |
| `idempotency_key` | `UUID`          | NULL | UQ (FR-SAL-07)                                                            |
| audit columns     |                 | NN   | see conventions                                                           |

```sql
-- One CHECK per column (IMS-02.5 TC-DB-055, migration 20261118000000_invoice_draft_checks).
-- A single CHECK on all three columns let a DRAFT invoice keep only one of them.
ALTER TABLE sales_invoices
  ADD CONSTRAINT sales_invoices_invoice_number_consistent
    CHECK ((status = 'DRAFT') = (invoice_number IS NULL)),
  ADD CONSTRAINT sales_invoices_confirmed_at_consistent
    CHECK ((status = 'DRAFT') = (confirmed_at IS NULL)),
  ADD CONSTRAINT sales_invoices_confirmed_by_consistent
    CHECK ((status = 'DRAFT') = (confirmed_by IS NULL));

CREATE SEQUENCE invoice_seq;   -- gaps allowed on rollback, numbers never reused (Q19)
CREATE INDEX sales_invoices_customer_idx ON sales_invoices (customer_id);
CREATE INDEX sales_invoices_confirmed_at ON sales_invoices (confirmed_at DESC);   -- FR-SAL-11
```

> Review point: `payment_method` is required on confirm in the DDL but is a _Should_ (FR-SAL-10) in the SRS, so it is left out of the consistency check here. See section 6.

---

### 2.10 `sales_invoice_lines`

| Column       | Type            | Null | Rule                                                                                |
| ------------ | --------------- | ---- | ----------------------------------------------------------------------------------- |
| `id`         | `BIGSERIAL`     | NN   | PK                                                                                  |
| `invoice_id` | `BIGINT`        | NN   | FK → `sales_invoices.id` CASCADE                                                    |
| `product_id` | `BIGINT`        | NN   | FK → `products.id` RESTRICT                                                         |
| `quantity`   | `INTEGER`       | NN   | CK `> 0`                                                                            |
| `unit_price` | `NUMERIC(12,2)` | NN   | CK `BETWEEN 0 AND 9999999.99`; copied from `products.selling_price` at sale (BR-06) |
| `line_total` | `NUMERIC(12,2)` |      | `GENERATED ALWAYS AS (quantity * unit_price) STORED`                                |

```sql
ALTER TABLE sales_invoice_lines
  ADD CONSTRAINT invoice_lines_one_per_product UNIQUE (invoice_id, product_id);
CREATE INDEX invoice_lines_product_idx ON sales_invoice_lines (product_id);
```

---

### 2.11 `sales_returns`

| Column          | Type            | Null | Rule                                                         |
| --------------- | --------------- | ---- | ------------------------------------------------------------ |
| `id`            | `BIGSERIAL`     | NN   | PK                                                           |
| `return_number` | `CHAR(15)`      | NN   | UQ; format `RET-2026-000012` (Q20 default)                   |
| `invoice_id`    | `BIGINT`        | NN   | FK → `sales_invoices.id` RESTRICT; one invoice, many returns |
| `reason`        | `VARCHAR(255)`  | NN   | CK not empty (FR-RET-03)                                     |
| `refund_total`  | `NUMERIC(12,2)` | NN   | CK `>= 0`; sum of line refunds                               |
| `processed_by`  | `BIGINT`        | NN   | FK → `users.id`                                              |
| `processed_at`  | `TIMESTAMPTZ`   | NN   | default `now()`                                              |

`processed_by` and `processed_at` play the role of `created_by` and `created_at`. A return is never edited, so it has no `updated_at`.

```sql
CREATE INDEX sales_returns_invoice_idx ON sales_returns (invoice_id);
```

---

### 2.12 `sales_return_lines`

| Column            | Type            | Null | Rule                                                      |
| ----------------- | --------------- | ---- | --------------------------------------------------------- |
| `id`              | `BIGSERIAL`     | NN   | PK                                                        |
| `return_id`       | `BIGINT`        | NN   | FK → `sales_returns.id` RESTRICT                          |
| `invoice_line_id` | `BIGINT`        | NN   | FK → `sales_invoice_lines.id` RESTRICT                    |
| `quantity`        | `INTEGER`       | NN   | CK `> 0`                                                  |
| `condition`       | `VARCHAR(10)`   | NN   | CK `IN ('RESELLABLE','DAMAGED')` (BR-08)                  |
| `refund_amount`   | `NUMERIC(12,2)` | NN   | CK `>= 0`; = quantity × original `unit_price` (FR-RET-05) |

```sql
ALTER TABLE sales_return_lines
  ADD CONSTRAINT return_lines_one_per_invoice_line UNIQUE (return_id, invoice_line_id);
CREATE INDEX return_lines_invoice_line_idx ON sales_return_lines (invoice_line_id);
```

BR-07 (returned ≤ sold − already returned) spans several rows, so a CHECK cannot enforce it. The return transaction locks the invoice line (`FOR UPDATE`), sums earlier return lines and rejects with `422` when the limit is passed.

---

### 2.13 `stock_movements`

See section 3 for the full ledger design.

| Column         | Type           | Null | Rule                                                                   |
| -------------- | -------------- | ---- | ---------------------------------------------------------------------- |
| `id`           | `BIGSERIAL`    | NN   | PK                                                                     |
| `product_id`   | `BIGINT`       | NN   | FK → `products.id` RESTRICT                                            |
| `type`         | `VARCHAR(10)`  | NN   | CK `IN ('RECEIPT','SALE','RETURN','ADJUSTMENT')`                       |
| `quantity`     | `INTEGER`      | NN   | CK `<> 0`; signed (+ in, − out)                                        |
| `stock_before` | `INTEGER`      | NN   | CK `>= 0`                                                              |
| `stock_after`  | `INTEGER`      | NN   | CK `>= 0`                                                              |
| `ref_type`     | `VARCHAR(20)`  | NN   | CK `IN ('PURCHASE_ORDER','SALES_INVOICE','SALES_RETURN','ADJUSTMENT')` |
| `ref_id`       | `BIGINT`       | NN   | id of the source document (logical link, no FK)                        |
| `reason`       | `VARCHAR(10)`  | NULL | CK `IN ('DAMAGED','LOST','MISCOUNT','FOUND')` (Q9)                     |
| `note`         | `VARCHAR(255)` | NULL | required for adjustments (FR-INV-05)                                   |
| `user_id`      | `BIGINT`       | NN   | FK → `users.id`                                                        |
| `created_at`   | `TIMESTAMPTZ`  | NN   | default `now()`                                                        |

---

### 2.14 `audit_log`

See section 4.

| Column        | Type          | Null | Rule                                             |
| ------------- | ------------- | ---- | ------------------------------------------------ |
| `id`          | `BIGSERIAL`   | NN   | PK                                               |
| `entity`      | `VARCHAR(40)` | NN   | table name, e.g. `products`                      |
| `entity_id`   | `BIGINT`      | NN   | id of the changed row                            |
| `action`      | `VARCHAR(40)` | NN   | e.g. `ROLE_CHANGE`, `PRICE_CHANGE`, `ADJUSTMENT` |
| `before_json` | `JSONB`       | NULL | NULL on create                                   |
| `after_json`  | `JSONB`       | NULL | NULL on delete-like actions                      |
| `user_id`     | `BIGINT`      | NN   | FK → `users.id`                                  |
| `created_at`  | `TIMESTAMPTZ` | NN   | default `now()`                                  |

---

### 2.15 `idempotency_keys`

Helper table added after the BA review (IMS-02.4, point 2), on top of the 14 tables of SRS section 5. Migration `20261111000100_idempotency_keys`. Serves FR-SAL-07 and FR-RET-06: a retry or double click creates one document and one stock change.

| Column          | Type          | Null | Rule                                                                        |
| --------------- | ------------- | ---- | --------------------------------------------------------------------------- |
| `user_id`       | `BIGINT`      | NN   | PK (part 1); FK → `users.id` RESTRICT                                       |
| `key`           | `UUID`        | NN   | PK (part 2); the `Idempotency-Key` header value (UUID v4)                   |
| `request_hash`  | `CHAR(64)`    | NN   | 64-character hash of the request body, to spot a reused key with a new body |
| `response_code` | `SMALLINT`    | NULL | HTTP status of the first response; NULL until that request has finished     |
| `response_body` | `JSONB`       | NULL | the stored response, returned again on a retry                              |
| `created_at`    | `TIMESTAMPTZ` | NN   | default `now()`                                                             |

How the API uses it (engineering spec 1.1, step 7):

- Same user, same key, same `request_hash`: return the stored response and change nothing.
- Same key, different `request_hash`: reject with `422 IDEMPOTENCY_KEY_REUSED`.
- The response is stored after `COMMIT`.
- `sales_invoices.idempotency_key` stays as a second guard on the invoice itself.

---

## 3. Stock movement ledger (IMS-02.3, FR-INV-03)

### 3.1 What one row means

One row records one change to one product's stock: what kind of change, by how much, the stock before and after, which document caused it, why, who and when.

### 3.2 Integrity rules

```sql
ALTER TABLE stock_movements
  ADD CONSTRAINT movements_after_matches
    CHECK (stock_after = stock_before + quantity),
  ADD CONSTRAINT movements_adjustment_needs_reason
    CHECK ((type = 'ADJUSTMENT') = (reason IS NOT NULL AND note IS NOT NULL)),   -- BR-09
  ADD CONSTRAINT movements_reason_direction
    CHECK (type <> 'ADJUSTMENT'
           OR (reason IN ('DAMAGED','LOST') AND quantity < 0)
           OR (reason = 'FOUND'            AND quantity > 0)
           OR (reason = 'MISCOUNT'));                                            -- Q14 default

CREATE INDEX movements_product_time ON stock_movements (product_id, created_at DESC);  -- FR-INV-04, FR-PRD-07
CREATE INDEX movements_type_time    ON stock_movements (type, created_at DESC);
CREATE INDEX movements_user_time    ON stock_movements (user_id, created_at DESC);     -- FR-INV-04
```

| Type         | Sign of `quantity` | `ref_type`       | `ref_id` points to                                      | Written by                                 |
| ------------ | ------------------ | ---------------- | ------------------------------------------------------- | ------------------------------------------ |
| `RECEIPT`    | +                  | `PURCHASE_ORDER` | `purchase_orders.id`                                    | PO receive (FR-PO-05)                      |
| `SALE`       | −                  | `SALES_INVOICE`  | `sales_invoices.id`                                     | Invoice confirm (FR-SAL-05)                |
| `RETURN`     | +                  | `SALES_RETURN`   | `sales_returns.id`                                      | Return of a `RESELLABLE` line only (BR-08) |
| `ADJUSTMENT` | + or − by reason   | `ADJUSTMENT`     | `audit_log.id` of the adjustment's audit row (proposed) | Administrator adjustment (FR-INV-05)       |

`ref_id` is a logical link with no foreign key, because it points to different tables. The stock service sets it.

Adjustments have no table of their own, so the SRS does not say what `ref_id` holds for them. Proposed: the adjustment transaction writes its `audit_log` row first (FR-AUD-01 needs one anyway) and uses that row's `id` as `ref_id`. Then every adjustment movement links to its audit record:

```sql
BEGIN;
SELECT stock_qty FROM products WHERE id = 1 FOR UPDATE;          -- 48
WITH a AS (
  INSERT INTO audit_log (entity, entity_id, action, before_json, after_json, user_id)
  VALUES ('products', 1, 'ADJUSTMENT', '{"stock_qty":48}',
          '{"stock_qty":47,"reason":"LOST","note":"missing at count"}', 1)
  RETURNING id)
INSERT INTO stock_movements (product_id, type, quantity, stock_before, stock_after,
                             ref_type, ref_id, reason, note, user_id)
SELECT 1, 'ADJUSTMENT', -1, 48, 47, 'ADJUSTMENT', a.id, 'LOST', 'missing at count', 1 FROM a;
UPDATE products SET stock_qty = 47 WHERE id = 1;
COMMIT;
```

Damaged returns write no movement (BR-08), because the item does not go back into stock.

### 3.3 Append-only rule

**Rows in `stock_movements` are never updated or deleted, by anyone, for any reason.** A mistake is corrected with a new `ADJUSTMENT` row, never by editing an old one.

| Layer                       | Enforcement                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| Database permission         | The app connects as `smartmart_app`, which has `SELECT` and `INSERT` only |
| Database trigger (proposed) | Rejects `UPDATE`, `DELETE` and `TRUNCATE` even for the owner role         |
| API                         | No update or delete endpoint exists for movements                         |

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON stock_movements, audit_log FROM smartmart_app;   -- BR-02, FR-INV-03

CREATE FUNCTION reject_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_append_only
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION reject_change();
CREATE TRIGGER stock_movements_no_truncate
  BEFORE TRUNCATE ON stock_movements
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change();
```

### 3.4 How stock changes (BR-02, BR-05, NFR-REL-01)

`products.stock_qty` is a fast-read copy of the ledger. It changes only here, in one transaction:

1. `BEGIN`
2. Lock the document row (`SELECT … FOR UPDATE`) and check its status.
3. Lock the product rows in ascending `id` order (prevents deadlocks).
4. For each line, compute the new quantity and reject with `422 INSUFFICIENT_STOCK` if it is below 0 (BR-01).
5. `UPDATE products SET stock_qty = …` and `INSERT` one `stock_movements` row per line with `stock_before` and `stock_after`.
6. `INSERT` the `audit_log` row where FR-AUD-01 applies, and update the document status.
7. `COMMIT`. Any error rolls back everything; no half-done change remains.

### 3.5 Reconciliation (FR-INV-01)

Stock must always equal the sum of its movements. This query must return **no rows**; it runs nightly and in CI.

```sql
SELECT p.id, p.sku, p.stock_qty, COALESCE(SUM(m.quantity), 0) AS ledger_qty
FROM products p
LEFT JOIN stock_movements m ON m.product_id = p.id
GROUP BY p.id
HAVING p.stock_qty <> COALESCE(SUM(m.quantity), 0);
```

---

## 4. Audit log (IMS-02.3, FR-AUD-01)

### 4.1 What is recorded

| Event                           | `entity`   | `action`                    | `before_json` / `after_json`                                                |
| ------------------------------- | ---------- | --------------------------- | --------------------------------------------------------------------------- |
| Staff account created           | `users`    | `CREATE`                    | NULL / new row without `password_hash`                                      |
| Staff details or role changed   | `users`    | `UPDATE` / `ROLE_CHANGE`    | changed fields only                                                         |
| Staff deactivated / reactivated | `users`    | `DEACTIVATE` / `REACTIVATE` | `{"is_active": …}`                                                          |
| Product price changed           | `products` | `PRICE_CHANGE`              | `{"selling_price": "950.00"}` / `{"selling_price": "990.00"}`               |
| Stock adjusted                  | `products` | `ADJUSTMENT`                | `{"stock_qty": 47}` / `{"stock_qty": 45, "reason": "DAMAGED", "note": "…"}` |

Password hashes and tokens are never written to the audit log (FR-AUTH-04).

The `/api/users` API writes `USER_CREATED`, `USER_UPDATED`, `ROLE_CHANGED`,
`USER_DEACTIVATED`, and `USER_REACTIVATED` actions for entity `USER`.

### 4.2 Rules

- The audit row is written **in the same transaction** as the change it describes.
- `audit_log` is **append-only**, with the same `REVOKE` and triggers as `stock_movements`:

```sql
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_change();
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change();

CREATE INDEX audit_log_entity_time ON audit_log (entity, entity_id, created_at DESC);
CREATE INDEX audit_log_user_time   ON audit_log (user_id, created_at DESC);
```

Acceptance example (Gherkin, @FR-AUD-01): when `sadia` changes KB-K120's selling price from 950.00 to 990.00, one audit row records sadia, the time, before 950.00 and after 990.00.

---

## 5. Traceability

| Rule          | Requirement                                   | Enforced by (database)                                               | Enforced by (code)                                          |
| ------------- | --------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| **BR-01**     | Stock never below zero                        | `products_stock_qty_nonneg`; `stock_before >= 0`, `stock_after >= 0` | Row lock + check in stock service, `422 INSUFFICIENT_STOCK` |
| **BR-12**     | SKU unique ignoring case                      | `products_sku_ci` unique index on `lower(sku)`                       | `409` on duplicate                                          |
| **BR-12**     | SKU fixed after first movement                | `products_sku_locked` trigger (proposed)                             | Product service update check                                |
| **FR-INV-08** | Never negative, in DB and code                | Same as BR-01                                                        | Same as BR-01                                               |
| **FR-INV-03** | Every change is a movement; no edit or delete | `stock_movements` CHECKs; `REVOKE`; append-only triggers             | Only the stock service writes `stock_qty`                   |
| **FR-AUD-01** | Audit trail of admin changes                  | `audit_log` table; `REVOKE`; append-only triggers                    | Audit row in the same transaction                           |

### Negative checks for QA (IMS-02.5)

Run as `smartmart_app` against a seeded database. Each statement must fail.

| #   | Rule      | Statement                                                                                           | Expected                                            |
| --- | --------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | BR-01     | `UPDATE products SET stock_qty = -1 WHERE sku = 'KB-K120';`                                         | check violation `products_stock_qty_nonneg`         |
| 2   | BR-01     | `INSERT INTO stock_movements (…, stock_before, quantity, stock_after, …) VALUES (…, 2, -3, -1, …);` | check violation `stock_movements_stock_after_check` |
| 3   | BR-12     | `INSERT INTO products (sku, …) VALUES ('kb-k120', …);` when `KB-K120` exists                        | unique violation `products_sku_ci`                  |
| 4   | BR-12     | `UPDATE products SET sku = 'KB-K121' WHERE sku = 'KB-K120';` after a movement exists                | exception "SKU is locked"                           |
| 5   | FR-INV-03 | `UPDATE stock_movements SET quantity = 5 WHERE id = 1;`                                             | permission denied                                   |
| 6   | FR-INV-03 | `DELETE FROM stock_movements WHERE id = 1;`                                                         | permission denied                                   |
| 7   | FR-INV-03 | movement with `stock_after <> stock_before + quantity`                                              | check violation `movements_after_matches`           |
| 8   | BR-09     | `ADJUSTMENT` movement with no `reason` or no `note`                                                 | check violation `movements_adjustment_needs_reason` |
| 9   | FR-AUD-01 | `UPDATE audit_log SET action = 'X' WHERE id = 1;`                                                   | permission denied                                   |

---

## 6. Open points for the review (IMS-02.4)

The main SRS section 5 and the engineering DDL v0.3 differ on these points. This document follows section 5, as IMS-02 asks. The BA (Md. Rabiul Islam) answered all 11 points on 11 Nov 2026; the Decision column records the answers.

| #   | Point                             | Section 5 (this doc)                    | DDL v0.3                                                            | Decision                                                                                                                                                       |
| --- | --------------------------------- | --------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Roles                             | `roles` table + `users.role_id` FK      | Enum `user_role` on `users.role`                                    | Approved. Keep `roles` and `users.role_id`; 3 fixed rows, no API to create roles.                                                                              |
| 2   | Idempotency                       | `sales_invoices.idempotency_key` column | Separate `idempotency_keys` table, also used by returns (FR-RET-06) | Approved with change. Keep `sales_invoices.idempotency_key` and add the `idempotency_keys` table (migration `20261111000100`).                                 |
| 3   | Sessions                          | No table                                | `refresh_tokens` table (FR-AUTH-02)                                 | Approved. `refresh_tokens` (hash only, `expires_at`, `revoked_at`) is added in IMS-05. Not built yet.                                                          |
| 4   | User name column                  | `name`                                  | `full_name`, plus `must_reset_pw`, `failed_logins`, `locked_until`  | Approved with change. Keep `name`; add `failed_logins`, `first_failed_at`, `locked_until` (migration `20261111000000`). Reset all three on a successful login. |
| 5   | Status and type lists             | `VARCHAR` + CHECK                       | PostgreSQL `ENUM` types                                             | Approved. `VARCHAR` + CHECK, with the same uppercase codes the API uses.                                                                                       |
| 6   | `customers.created_by`            | Required (every business table)         | Not present                                                         | Approved. Required; the seeded walk-in customer uses the seeded admin as `created_by`.                                                                         |
| 7   | `payment_method` on confirm       | Optional (FR-SAL-10 is _Should_)        | Required by the confirm CHECK                                       | Approved. Optional now (`CASH`, `CARD`, `MOBILE_BANKING`); IMS-36 adds the check that a confirmed invoice has one.                                             |
| 8   | SKU lock and append-only triggers | Proposed here                           | Not in the DDL (REVOKE only)                                        | Approved. Keep both triggers, add `BEFORE TRUNCATE` triggers, revoke `UPDATE` and `DELETE` from the app user. Already in the init migration.                   |
| 9   | Phone format                      | "11 digits starting 01"                 | Regex `^01[3-9][0-9]{8}$` (stricter)                                | Keep the SRS rule `^01[0-9]{9}$`; the stricter 013 to 019 rule would need an SRS change. Migration `20261111000200`.                                           |
| 10  | Audit columns on line tables      | "Every business table"                  | Not on line tables                                                  | Approved. Line tables follow their parent document's audit columns; the BA adds one line to SRS section 5.                                                     |
| 11  | `ref_id` for adjustments          | Not defined                             | Not defined                                                         | Approved. `ref_type = 'ADJUSTMENT'`, `ref_id = audit_log.id`, both written in one transaction (FR-AUD-01, BR-09).                                              |

---

## 7. Verification

All rules in this document were built on PostgreSQL 16.15 and tested on 2026-11-04 with the seed product KB-K120 (stock 50).

| Result                                                                                                                               | Checks                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| All 14 tables created without errors                                                                                                 | DDL                                                                                                                               |
| 9 / 9 negative checks in section 5 rejected                                                                                          | BR-01, BR-09, BR-12, FR-INV-03, FR-AUD-01                                                                                         |
| 6 / 6 extra negative checks rejected                                                                                                 | duplicate category (other case), second walk-in row, bad phone, DAMAGED with +1, delete category in use, price above 9,999,999.99 |
| Owner role also blocked from `UPDATE`, `DELETE`, `TRUNCATE` on `stock_movements` and `audit_log`                                     | append-only triggers                                                                                                              |
| Valid adjustment accepted; reconciliation query returns 0 rows; generated `line_total` = 3 × 950.00 = 2850.00                        | positive checks                                                                                                                   |
| Full adjustment transaction (section 3.2) as `smartmart_app`: stock 48 → 47, movement linked to its audit row, reconciliation 0 rows | FR-INV-03, FR-INV-05, FR-AUD-01                                                                                                   |
| Transaction with an audit row followed by `stock_qty = -1`: rejected and fully rolled back (no audit row left, stock unchanged)      | BR-01, NFR-REL-01                                                                                                                 |

---

## 8. Changes after the BA review (IMS-02.4)

Applied on 2026-11-11 as new migrations (the init migration is not edited, so databases that already ran it stay valid). Each has a `down.sql`; `npm run db:down` runs them all, newest first.

| Migration                              | Change                                                                                   | BA point |
| -------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| `20261111000000_users_login_throttle`  | `users.failed_logins`, `first_failed_at`, `locked_until` and `users_failed_logins_check` | 4        |
| `20261111000100_idempotency_keys`      | new table `idempotency_keys` (section 2.15)                                              | 2        |
| `20261111000200_phone_format_srs_rule` | `suppliers_phone_check` and `customers_phone_check` use `^01[0-9]{9}$`                   | 9        |

Checked on the local development database:

| Result                                                                                                                                                   | Checks       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `failed_logins = -1` rejected by `users_failed_logins_check`; existing users show `0`, `NULL`, `NULL`                                                    | point 4      |
| `idempotency_keys`: same user and key twice rejected (PK); same key for another user accepted; unknown user, non-UUID key and 65-character hash rejected | point 2      |
| Phone: 010 and 012 numbers accepted; 10 digits, 12 digits, `02...` prefix and letters rejected; customer without phone (not walk-in) still rejected      | point 9      |
| Each `down.sql` undoes its migration and the migration applies again                                                                                     | all three    |
| `prisma migrate diff` between `schema.prisma` and the database: no difference                                                                            | all three    |
| `db:down` then `db:setup` on an empty database: all 4 migrations undone and applied again, seed counts unchanged                                         | down scripts |

---

## 9. Fixes after QA testing (IMS-02.5)

| Migration                             | Change                                                                                                                                                                                               | Bug                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `20261112000000_po_received_checks`   | `purchase_orders_received_consistent` is replaced by `purchase_orders_received_at_consistent` and `purchase_orders_received_by_consistent` (section 2.7)                                             | Bug 1, TC-DB-041 (DRAFT order with only `received_at`) |
| `20261118000000_invoice_draft_checks` | `sales_invoices_confirmed_consistent` is replaced by `sales_invoices_invoice_number_consistent`, `sales_invoices_confirmed_at_consistent` and `sales_invoices_confirmed_by_consistent` (section 2.9) | TC-DB-055 (DRAFT invoice with only `invoice_number`)   |

Cause: the old CHECK compared the status with `received_at AND received_by` together, so a row with only one of the two columns passed when the status was not `RECEIVED`.

Checked on the local development database (each insert in a rolled-back transaction):

| Row                                                      | Result                                               |
| -------------------------------------------------------- | ---------------------------------------------------- |
| DRAFT, `received_at` set, `received_by` NULL (TC-DB-041) | rejected by `purchase_orders_received_at_consistent` |
| DRAFT, `received_at` NULL, `received_by` set             | rejected by `purchase_orders_received_by_consistent` |
| RECEIVED, `received_at` set, `received_by` NULL          | rejected by `purchase_orders_received_by_consistent` |
| DRAFT, both NULL; RECEIVED, both set                     | accepted; the two seeded received orders pass        |

`down.sql` restores the old CHECK (as `NOT VALID`) and the migration applies again; `prisma migrate diff` shows no difference.

Not changed here: TC-DB-054 (`payment_method` on a confirmed invoice) follows the BA's point 7 decision (check added in IMS-36) and is marked Deferred.

### Invoice CHECKs (TC-DB-055)

Cause: the old CHECK compared the status with `invoice_number`, `confirmed_at` and `confirmed_by` together, so a DRAFT invoice with only one of them passed. BA answer of 17 Nov: a draft has none of the three, any other status has all three; `invoice_number` stays unique.

Checked on the local development database (each insert in a rolled-back transaction):

| Row                                          | Result                                                 |
| -------------------------------------------- | ------------------------------------------------------ |
| DRAFT, only `invoice_number` set (TC-DB-055) | rejected by `sales_invoices_invoice_number_consistent` |
| DRAFT, only `confirmed_at` set               | rejected by `sales_invoices_confirmed_at_consistent`   |
| DRAFT, only `confirmed_by` set               | rejected by `sales_invoices_confirmed_by_consistent`   |
| CONFIRMED, all three set                     | accepted                                               |
| DRAFT, all three empty                       | accepted                                               |
| CONFIRMED, only `invoice_number` set         | rejected by `sales_invoices_confirmed_at_consistent`   |

`down.sql` restores the old CHECK (as `NOT VALID`) and the migration applies again.
