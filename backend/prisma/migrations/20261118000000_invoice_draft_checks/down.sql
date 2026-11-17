-- IMS-02.5 TC-DB-055 | DOWN migration for 20261118000000_invoice_draft_checks
-- Prisma has no built-in "down", so this file undoes migration.sql by hand.
-- Run it with:  npx prisma db execute --file prisma/migrations/20261118000000_invoice_draft_checks/down.sql --schema prisma/schema.prisma
-- Restores the original single CHECK from the init migration (it accepts half-filled invoice rows again).
-- NOT VALID: existing rows are not re-checked, so this down never fails and "npm run db:down" can continue.

ALTER TABLE "sales_invoices" DROP CONSTRAINT IF EXISTS "sales_invoices_confirmed_by_consistent";
ALTER TABLE "sales_invoices" DROP CONSTRAINT IF EXISTS "sales_invoices_confirmed_at_consistent";
ALTER TABLE "sales_invoices" DROP CONSTRAINT IF EXISTS "sales_invoices_invoice_number_consistent";

ALTER TABLE "sales_invoices"
  ADD CONSTRAINT "sales_invoices_confirmed_consistent"
    CHECK (("status" = 'CONFIRMED') = ("invoice_number" IS NOT NULL AND "confirmed_at" IS NOT NULL AND "confirmed_by" IS NOT NULL)) NOT VALID;

-- Also remove this migration's record so "prisma migrate deploy" re-applies it:
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261118000000_invoice_draft_checks';
