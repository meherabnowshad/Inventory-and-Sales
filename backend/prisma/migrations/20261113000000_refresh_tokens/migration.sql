-- IMS-05 | Migration: refresh_tokens table (BA decision, point 3)
-- Serves FR-AUTH-02 (logout revokes token -> 401), FR-AUTH-03 (session expiry & refresh),
-- and NFR-SEC-05 (8h rotating refresh token, stored hashed as SHA-256 hex, revoked on logout or user deactivation).
-- Undo with down.sql in this folder.

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Same access as every other table for the application role (the init migration grant only
-- covered tables that existed at that time). Skipped when the role is not on this machine.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartmart_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "refresh_tokens" TO smartmart_app;
    GRANT USAGE, SELECT ON SEQUENCE "refresh_tokens_id_seq" TO smartmart_app;
  END IF;
END $$;

