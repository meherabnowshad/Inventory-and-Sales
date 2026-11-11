-- IMS-05 | DOWN migration for 20261111000300_refresh_tokens
-- Prisma has no built-in "down", so this file undoes migration.sql by hand.
-- Run it with:  npx prisma db execute --file prisma/migrations/20261111000300_refresh_tokens/down.sql --schema prisma/schema.prisma
-- Run it BEFORE the init down.sql: this table has a foreign key to users.
-- WARNING: deletes all stored refresh tokens (active sessions will need to log in again).

DROP TABLE IF EXISTS "refresh_tokens";

-- Also remove this migration's record so "prisma migrate deploy" re-applies it:
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261111000300_refresh_tokens';

