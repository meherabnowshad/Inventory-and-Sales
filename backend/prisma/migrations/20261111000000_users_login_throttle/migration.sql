-- IMS-02.4 | Migration: login throttle columns on users (BA decision, point 4)
-- Serves FR-AUTH-05: after 5 failed logins in 15 minutes the account waits 15 minutes.
-- failed_logins   = failures counted in the current window
-- first_failed_at = when the current window started (lets the API check "within 15 minutes")
-- locked_until    = login refused until this time (NULL = not locked)
-- The auth service (IMS-05.4) resets all three to 0 / NULL / NULL on a successful login.
-- Undo with down.sql in this folder.

ALTER TABLE "users"
  ADD COLUMN "failed_logins" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "first_failed_at" TIMESTAMPTZ(6),
  ADD COLUMN "locked_until" TIMESTAMPTZ(6);

ALTER TABLE "users"
  ADD CONSTRAINT "users_failed_logins_check" CHECK ("failed_logins" >= 0);
