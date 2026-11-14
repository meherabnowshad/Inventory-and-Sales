-- IMS-02.5 Bug 1 | DOWN migration for 20261112000000_po_received_checks
-- Prisma has no built-in "down", so this file undoes migration.sql by hand.
-- Run it with:  npx prisma db execute --file prisma/migrations/20261112000000_po_received_checks/down.sql --schema prisma/schema.prisma
-- Restores the original single CHECK from the init migration (it accepts half-filled receipt rows again).
-- NOT VALID: existing rows are not re-checked, so this down never fails and "npm run db:down" can continue.

ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_received_by_consistent";
ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_received_at_consistent";

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_received_consistent"
    CHECK (("status" = 'RECEIVED') = ("received_at" IS NOT NULL AND "received_by" IS NOT NULL)) NOT VALID;

-- Also remove this migration's record so "prisma migrate deploy" re-applies it:
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261112000000_po_received_checks';
