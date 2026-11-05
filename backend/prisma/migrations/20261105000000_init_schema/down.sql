-- IMS-04.1 | DOWN migration for 20261105000000_init_schema
-- Prisma has no built-in "down", so this file undoes migration.sql by hand.
-- Run it with:  npx prisma db execute --file prisma/migrations/20261105000000_init_schema/down.sql --schema prisma/schema.prisma
-- WARNING: deletes all 14 tables and their data.

-- Triggers and functions first
DROP TRIGGER IF EXISTS audit_log_no_truncate ON "audit_log";
DROP TRIGGER IF EXISTS audit_log_append_only ON "audit_log";
DROP TRIGGER IF EXISTS stock_movements_no_truncate ON "stock_movements";
DROP TRIGGER IF EXISTS stock_movements_append_only ON "stock_movements";
DROP TRIGGER IF EXISTS products_sku_locked ON "products";
DROP FUNCTION IF EXISTS reject_change();
DROP FUNCTION IF EXISTS products_sku_locked();

-- Tables in reverse dependency order (children before parents)
DROP TABLE IF EXISTS "audit_log";
DROP TABLE IF EXISTS "stock_movements";
DROP TABLE IF EXISTS "sales_return_lines";
DROP TABLE IF EXISTS "sales_returns";
DROP TABLE IF EXISTS "sales_invoice_lines";
DROP TABLE IF EXISTS "sales_invoices";
DROP TABLE IF EXISTS "purchase_order_lines";
DROP TABLE IF EXISTS "purchase_orders";
DROP TABLE IF EXISTS "customers";
DROP TABLE IF EXISTS "suppliers";
DROP TABLE IF EXISTS "products";
DROP TABLE IF EXISTS "categories";
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "roles";

DROP SEQUENCE IF EXISTS "invoice_seq";

-- Tell Prisma this migration is no longer applied, so "prisma migrate deploy" can run it again
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    DELETE FROM "_prisma_migrations" WHERE migration_name = '20261105000000_init_schema';
  END IF;
END $$;
