-- IMS-02.4 | DOWN migration for 20261111000000_users_login_throttle
-- Prisma has no built-in "down", so this file undoes migration.sql by hand.
-- Run it with:  npx prisma db execute --file prisma/migrations/20261111000000_users_login_throttle/down.sql --schema prisma/schema.prisma
-- Run it BEFORE the init down.sql if you want to undo both migrations.
-- WARNING: deletes the throttle state of every user (data is only login counters).

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_failed_logins_check";
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "locked_until",
  DROP COLUMN IF EXISTS "first_failed_at",
  DROP COLUMN IF EXISTS "failed_logins";

-- Also remove this migration's record so "prisma migrate deploy" re-applies it:
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261111000000_users_login_throttle';
