-- IMS-02.4 | Migration: idempotency_keys table (BA decision, point 2)
-- Serves FR-SAL-07 and FR-RET-06 (a retry or double click creates one document, one stock change).
-- Every stock-changing call (receive, confirm, returns, adjustments) sends an Idempotency-Key header
-- (UUID v4). The API stores the key with a hash of the request body and, after COMMIT, the response.
--   same key + same request_hash  -> return the stored response, change nothing
--   same key + different hash     -> reject with 422 IDEMPOTENCY_KEY_REUSED
-- response_code / response_body stay NULL until the first request has finished.
-- sales_invoices.idempotency_key (init migration) stays as a second, per-invoice guard.
-- Undo with down.sql in this folder.

CREATE TABLE "idempotency_keys" (
    "user_id" BIGINT NOT NULL,
    "key" UUID NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_code" SMALLINT,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("user_id", "key")
);

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Same access as every other table for the application role (the init migration grant only
-- covered tables that existed at that time). Skipped when the role is not on this machine.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartmart_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "idempotency_keys" TO smartmart_app;
  END IF;
END $$;
