-- IMS-02.4 | Migration: phone format follows the SRS rule (BA decision, point 9)
-- SRS section 6 validation rules: "11 digits and start with 01" -> ^01[0-9]{9}$
-- The init migration used a stricter rule (^01[3-9][0-9]{8}$, only 013 to 019).
-- A stricter rule needs an SRS change, which the BA is not making now.
-- Affects suppliers.phone (required) and customers.phone (NULL is still allowed for the
-- walk-in customer; a CHECK passes on NULL and customers_phone_required guards the rest).
-- Undo with down.sql in this folder.

ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_phone_check";
ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_phone_check" CHECK ("phone" ~ '^01[0-9]{9}$');

ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_check";
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_phone_check" CHECK ("phone" ~ '^01[0-9]{9}$');
