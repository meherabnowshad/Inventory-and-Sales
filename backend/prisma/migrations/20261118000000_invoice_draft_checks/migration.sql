-- IMS-02.5 TC-DB-055 (BAQ-DB-15) | Migration: sales invoice confirm columns, one CHECK per column
-- Problem: the old CHECK compared the status with invoice_number, confirmed_at and confirmed_by together,
-- so a DRAFT invoice with only one of them (for example only invoice_number) was accepted.
-- Fix (BA answer, Nov 17): a DRAFT invoice has none of the three, any other status has all three.
-- "Not a draft" is used instead of "is confirmed" so the rule still works when later statuses are added.
-- invoice_number stays unique (sales_invoices_invoice_number_key from the init migration).
-- Existing rows pass: the seed has no invoices. Undo with down.sql in this folder.

ALTER TABLE "sales_invoices" DROP CONSTRAINT "sales_invoices_confirmed_consistent";

ALTER TABLE "sales_invoices"
  ADD CONSTRAINT "sales_invoices_invoice_number_consistent"
    CHECK (("status" = 'DRAFT') = ("invoice_number" IS NULL)),
  ADD CONSTRAINT "sales_invoices_confirmed_at_consistent"
    CHECK (("status" = 'DRAFT') = ("confirmed_at" IS NULL)),
  ADD CONSTRAINT "sales_invoices_confirmed_by_consistent"
    CHECK (("status" = 'DRAFT') = ("confirmed_by" IS NULL));
