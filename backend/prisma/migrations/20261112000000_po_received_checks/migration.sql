-- IMS-02.5 Bug 1 (TC-DB-041) | Migration: purchase order receipt columns, one CHECK per column
-- Bug: the init CHECK was (status = 'RECEIVED') = (received_at IS NOT NULL AND received_by IS NOT NULL).
-- That only blocks a row when BOTH columns are present or BOTH are missing, so a DRAFT order with
-- only received_at (or only received_by) was accepted: half a receipt on an order not received (BR-03).
-- Fix: tie each column to the status on its own. A row is RECEIVED exactly when received_at is set,
-- and RECEIVED exactly when received_by is set. This also keeps the SRS rule
-- (status = 'RECEIVED') = (received_at IS NOT NULL) and adds received_by to it.
-- Existing rows pass: the seed receives its orders with both columns set, other orders have neither.
-- Undo with down.sql in this folder.

ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_received_consistent";

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_received_at_consistent"
    CHECK (("status" = 'RECEIVED') = ("received_at" IS NOT NULL)),
  ADD CONSTRAINT "purchase_orders_received_by_consistent"
    CHECK (("status" = 'RECEIVED') = ("received_by" IS NOT NULL));
