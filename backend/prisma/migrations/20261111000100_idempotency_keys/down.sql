-- IMS-02.4 | DOWN migration for 20261111000100_idempotency_keys
-- Prisma has no built-in "down", so this file undoes migration.sql by hand.
-- Run it with:  npx prisma db execute --file prisma/migrations/20261111000100_idempotency_keys/down.sql --schema prisma/schema.prisma
-- Run it BEFORE the init down.sql: this table has a foreign key to users.
-- WARNING: deletes all stored idempotency keys (only retry-protection data).

DROP TABLE IF EXISTS "idempotency_keys";

-- Also remove this migration's record so "prisma migrate deploy" re-applies it:
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261111000100_idempotency_keys';
