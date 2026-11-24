-- IMS-07: track users who must replace an administrator-issued temporary password.
ALTER TABLE "users"
ADD COLUMN "must_reset_pw" BOOLEAN NOT NULL DEFAULT false;
