-- IMS-04.1 | Migration: all 14 tables of SRS section 5
-- Source of truth: docs/database/schema.md (IMS-02, section 2 to 4)
-- Part 1 = tables, keys, indexes, foreign keys (what Prisma knows)
-- Part 2 = rules Prisma cannot express: CHECKs, lower() unique indexes,
--          partial indexes, SKU lock (BR-12), append-only ledger and audit log
--          (FR-INV-03, FR-AUD-01), REVOKE
-- Undo with down.sql in this folder.

-- =========================================================================
-- PART 1: TABLES, KEYS, INDEXES, FOREIGN KEYS
-- =========================================================================

-- CreateTable
CREATE TABLE "roles" (
    "id" SMALLSERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role_id" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" BIGSERIAL NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "purchase_price" DECIMAL(12,2) NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "contact_person" VARCHAR(120),
    "phone" CHAR(11) NOT NULL,
    "email" VARCHAR(254),
    "address" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" CHAR(11),
    "email" VARCHAR(254),
    "address" VARCHAR(255),
    "is_walk_in" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" BIGSERIAL NOT NULL,
    "po_number" CHAR(14) NOT NULL,
    "supplier_id" BIGINT NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'DRAFT',
    "order_date" DATE NOT NULL,
    "expected_date" DATE,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "received_by" BIGINT,
    "received_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable (line_total is a generated column, see schema.md section 2.8)
CREATE TABLE "purchase_order_lines" (
    "id" BIGSERIAL NOT NULL,
    "po_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) GENERATED ALWAYS AS ("quantity" * "unit_cost") STORED,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" BIGSERIAL NOT NULL,
    "invoice_number" CHAR(15),
    "customer_id" BIGINT NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_method" VARCHAR(15),
    "confirmed_by" BIGINT,
    "confirmed_at" TIMESTAMPTZ(6),
    "idempotency_key" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT NOT NULL,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable (line_total is a generated column)
CREATE TABLE "sales_invoice_lines" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) GENERATED ALWAYS AS ("quantity" * "unit_price") STORED,

    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" BIGSERIAL NOT NULL,
    "return_number" CHAR(15) NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "refund_total" DECIMAL(12,2) NOT NULL,
    "processed_by" BIGINT NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" BIGSERIAL NOT NULL,
    "return_id" BIGINT NOT NULL,
    "invoice_line_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" VARCHAR(10) NOT NULL,
    "refund_amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stock_before" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "ref_type" VARCHAR(20) NOT NULL,
    "ref_id" BIGINT NOT NULL,
    "reason" VARCHAR(10),
    "note" VARCHAR(255),
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "entity" VARCHAR(40) NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_date" ON "purchase_orders"("status", "order_date" DESC);

-- CreateIndex
CREATE INDEX "po_lines_product_idx" ON "purchase_order_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "po_lines_one_per_product" ON "purchase_order_lines"("po_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_invoice_number_key" ON "sales_invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_idempotency_key_key" ON "sales_invoices"("idempotency_key");

-- CreateIndex
CREATE INDEX "sales_invoices_customer_idx" ON "sales_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "sales_invoices_confirmed_at" ON "sales_invoices"("confirmed_at" DESC);

-- CreateIndex
CREATE INDEX "invoice_lines_product_idx" ON "sales_invoice_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_one_per_product" ON "sales_invoice_lines"("invoice_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_return_number_key" ON "sales_returns"("return_number");

-- CreateIndex
CREATE INDEX "sales_returns_invoice_idx" ON "sales_returns"("invoice_id");

-- CreateIndex
CREATE INDEX "return_lines_invoice_line_idx" ON "sales_return_lines"("invoice_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_lines_one_per_invoice_line" ON "sales_return_lines"("return_id", "invoice_line_id");

-- CreateIndex
CREATE INDEX "movements_product_time" ON "stock_movements"("product_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "movements_type_time" ON "stock_movements"("type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "movements_user_time" ON "stock_movements"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_entity_time" ON "audit_log"("entity", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_user_time" ON "audit_log"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sales_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "sales_invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================================
-- PART 2: RULES PRISMA CANNOT EXPRESS (hand-written, do not remove)
-- =========================================================================

-- ---- Case-insensitive unique values (BR-12 SKU, usernames, e-mail, category names)
CREATE UNIQUE INDEX "users_username_ci" ON "users" (lower("username"));
CREATE UNIQUE INDEX "users_email_ci" ON "users" (lower("email"));
CREATE UNIQUE INDEX "categories_name_ci" ON "categories" (lower("name"));
CREATE UNIQUE INDEX "products_sku_ci" ON "products" (lower("sku"));

-- ---- Partial indexes
-- low-stock list (FR-INV low stock alert) and exactly one walk-in customer (FR-CUS-03)
CREATE INDEX "products_low_stock" ON "products" ("category_id") WHERE "stock_qty" < "min_stock";
CREATE UNIQUE INDEX "customers_one_walk_in" ON "customers" ("is_walk_in") WHERE "is_walk_in";

-- ---- Invoice number counter (INV-YYYYMMDD-NNNN is built by the API from this)
CREATE SEQUENCE "invoice_seq";

-- ---- CHECK constraints
ALTER TABLE "roles"
  ADD CONSTRAINT "roles_name_check" CHECK ("name" IN ('Administrator','Sales Staff','Store Staff'));

ALTER TABLE "users"
  ADD CONSTRAINT "users_name_check" CHECK (btrim("name") <> '');

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_name_check" CHECK (btrim("name") <> '');

ALTER TABLE "products"
  ADD CONSTRAINT "products_sku_check" CHECK (btrim("sku") <> ''),
  ADD CONSTRAINT "products_name_check" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "products_purchase_price_check" CHECK ("purchase_price" BETWEEN 0 AND 9999999.99),
  ADD CONSTRAINT "products_selling_price_check" CHECK ("selling_price" BETWEEN 0 AND 9999999.99),
  ADD CONSTRAINT "products_min_stock_check" CHECK ("min_stock" >= 0),
  -- BR-01 / FR-INV-08: stock can never go below zero
  ADD CONSTRAINT "products_stock_qty_nonneg" CHECK ("stock_qty" >= 0);

ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_name_check" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "suppliers_phone_check" CHECK ("phone" ~ '^01[3-9][0-9]{8}$');

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_name_check" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "customers_phone_check" CHECK ("phone" ~ '^01[3-9][0-9]{8}$'),
  ADD CONSTRAINT "customers_phone_required" CHECK ("is_walk_in" OR "phone" IS NOT NULL);

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_status_check" CHECK ("status" IN ('DRAFT','ORDERED','RECEIVED','CANCELLED')),
  ADD CONSTRAINT "purchase_orders_total_check" CHECK ("total" >= 0),
  ADD CONSTRAINT "purchase_orders_received_consistent"
    CHECK (("status" = 'RECEIVED') = ("received_at" IS NOT NULL AND "received_by" IS NOT NULL));

ALTER TABLE "purchase_order_lines"
  ADD CONSTRAINT "purchase_order_lines_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "purchase_order_lines_unit_cost_check" CHECK ("unit_cost" BETWEEN 0 AND 9999999.99);

ALTER TABLE "sales_invoices"
  ADD CONSTRAINT "sales_invoices_status_check" CHECK ("status" IN ('DRAFT','CONFIRMED','CANCELLED')),
  ADD CONSTRAINT "sales_invoices_total_check" CHECK ("total" >= 0),
  ADD CONSTRAINT "sales_invoices_payment_method_check" CHECK ("payment_method" IN ('CASH','CARD','MOBILE_BANKING')),
  ADD CONSTRAINT "sales_invoices_confirmed_consistent"
    CHECK (("status" = 'CONFIRMED') = ("invoice_number" IS NOT NULL AND "confirmed_at" IS NOT NULL AND "confirmed_by" IS NOT NULL));

ALTER TABLE "sales_invoice_lines"
  ADD CONSTRAINT "sales_invoice_lines_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "sales_invoice_lines_unit_price_check" CHECK ("unit_price" BETWEEN 0 AND 9999999.99);

ALTER TABLE "sales_returns"
  ADD CONSTRAINT "sales_returns_reason_check" CHECK (btrim("reason") <> ''),
  ADD CONSTRAINT "sales_returns_refund_total_check" CHECK ("refund_total" >= 0);

ALTER TABLE "sales_return_lines"
  ADD CONSTRAINT "sales_return_lines_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "sales_return_lines_condition_check" CHECK ("condition" IN ('RESELLABLE','DAMAGED')),
  ADD CONSTRAINT "sales_return_lines_refund_amount_check" CHECK ("refund_amount" >= 0);

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_type_check" CHECK ("type" IN ('RECEIPT','SALE','RETURN','ADJUSTMENT')),
  ADD CONSTRAINT "stock_movements_quantity_check" CHECK ("quantity" <> 0),
  ADD CONSTRAINT "stock_movements_stock_before_check" CHECK ("stock_before" >= 0),
  ADD CONSTRAINT "stock_movements_stock_after_check" CHECK ("stock_after" >= 0),
  ADD CONSTRAINT "stock_movements_ref_type_check"
    CHECK ("ref_type" IN ('PURCHASE_ORDER','SALES_INVOICE','SALES_RETURN','ADJUSTMENT')),
  ADD CONSTRAINT "stock_movements_reason_check" CHECK ("reason" IN ('DAMAGED','LOST','MISCOUNT','FOUND')),
  ADD CONSTRAINT "movements_after_matches" CHECK ("stock_after" = "stock_before" + "quantity"),
  ADD CONSTRAINT "movements_adjustment_needs_reason"
    CHECK (("type" = 'ADJUSTMENT') = ("reason" IS NOT NULL AND "note" IS NOT NULL)),
  ADD CONSTRAINT "movements_reason_direction" CHECK ("type" <> 'ADJUSTMENT'
    OR ("reason" IN ('DAMAGED','LOST') AND "quantity" < 0)
    OR ("reason" = 'FOUND' AND "quantity" > 0)
    OR ("reason" = 'MISCOUNT'));

-- ---- BR-12: SKU is locked after the first stock movement
CREATE FUNCTION products_sku_locked() RETURNS trigger AS $$
BEGIN
  IF NEW.sku IS DISTINCT FROM OLD.sku
     AND EXISTS (SELECT 1 FROM stock_movements WHERE product_id = OLD.id) THEN
    RAISE EXCEPTION 'SKU is locked after the first stock movement (BR-12)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER products_sku_locked BEFORE UPDATE OF sku ON "products"
  FOR EACH ROW EXECUTE FUNCTION products_sku_locked();

-- ---- FR-INV-03 / FR-AUD-01: stock_movements and audit_log are append-only
CREATE FUNCTION reject_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_append_only BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION reject_change();
CREATE TRIGGER stock_movements_no_truncate BEFORE TRUNCATE ON "stock_movements"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change();
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION reject_change();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change();

-- ---- Application role: normal access, but no UPDATE/DELETE/TRUNCATE on the two history tables.
-- The role smartmart_app is created by the DBA (see backend/README.md). If it does not
-- exist on this machine (local development) the grants are skipped; the triggers above
-- still protect the history tables for every user.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartmart_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO smartmart_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO smartmart_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON stock_movements, audit_log FROM smartmart_app;
  ELSE
    RAISE NOTICE 'role smartmart_app not found: grants skipped (local development)';
  END IF;
END $$;
