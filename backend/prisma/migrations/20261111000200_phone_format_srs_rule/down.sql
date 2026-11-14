-- IMS-02.4 | DOWN migration for 20261111000200_phone_format_srs_rule
-- Prisma has no built-in "down", so this file undoes migration.sql by hand.
-- Run it with:  npx prisma db execute --file prisma/migrations/20261111000200_phone_format_srs_rule/down.sql --schema prisma/schema.prisma
-- Restores the stricter rule from the init migration (only 013 to 019) for NEW rows.
-- NOT VALID: rows that already exist (for example a 012 number) are not re-checked, so this
-- down never fails on data and "npm run db:down" can always continue.

ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_phone_check";
ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_phone_check" CHECK ("phone" ~ '^01[3-9][0-9]{8}$') NOT VALID;

ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_phone_check";
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_phone_check" CHECK ("phone" ~ '^01[3-9][0-9]{8}$') NOT VALID;

-- Also remove this migration's record so "prisma migrate deploy" re-applies it:
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261111000200_phone_format_srs_rule';
