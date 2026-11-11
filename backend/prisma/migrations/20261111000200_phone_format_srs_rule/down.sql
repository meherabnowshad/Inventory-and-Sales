-- IMS-02.4 | DOWN migration for 20261111000200_phone_format_srs_rule
-- Prisma has no built-in "down", so this file undoes migration.sql by hand.
-- Run it with:  npx prisma db execute --file prisma/migrations/20261111000200_phone_format_srs_rule/down.sql --schema prisma/schema.prisma
-- Restores the stricter rule from the init migration (only 013 to 019).
-- It fails if a supplier or customer with a 010, 011 or 012 number already exists:
-- fix or remove those rows first.

ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_phone_check";
ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_phone_check" CHECK ("phone" ~ '^01[3-9][0-9]{8}$');

ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_phone_check";
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_phone_check" CHECK ("phone" ~ '^01[3-9][0-9]{8}$');

-- Also remove this migration's record so "prisma migrate deploy" re-applies it:
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261111000200_phone_format_srs_rule';
