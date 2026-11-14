# Database Design (IMS-02)

Database design for the SmartMart Inventory & Sales Management System, based on SRS Group 1 (section 5 "Data requirements" and section 6 "Business rules").

|              |                                                            |
| ------------ | ---------------------------------------------------------- |
| **Database** | PostgreSQL 16                                              |
| **Author**   | Dev 1 · Md. Rashadul Islam                                 |
| **Reviewer** | Dev 2 · MD Meherab Hossain Nowshad                         |
| **Tester**   | QA 1 · Radouan Ahmed                                       |
| **Status**   | BA review answered 11 Nov 2026, changes applied (IMS-02.4) |

## Files

| File                     | What it is                                                                   | Task               |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------ |
| [erd.md](./erd.md)       | ER diagram of the 15 tables (renders on GitHub)                              | IMS-02.1           |
| [erd.png](./erd.png)     | ER diagram image                                                             | IMS-02.1           |
| [erd.dbml](./erd.dbml)   | Editable diagram source, open in [dbdiagram.io](https://dbdiagram.io)        | IMS-02.1           |
| [schema.md](./schema.md) | Keys, unique indexes, checks, foreign keys, stock ledger and audit log rules | IMS-02.2, IMS-02.3 |

## The 15 tables

| Group            | Tables                                                   |
| ---------------- | -------------------------------------------------------- |
| Staff and access | `users`, `roles`                                         |
| Master data      | `categories`, `products`, `suppliers`, `customers`       |
| Purchasing       | `purchase_orders`, `purchase_order_lines`                |
| Sales            | `sales_invoices`, `sales_invoice_lines`                  |
| Returns          | `sales_returns`, `sales_return_lines`                    |
| History          | `stock_movements`, `audit_log`                           |
| Retry protection | `idempotency_keys` (added after the BA review, IMS-02.4) |

## Key rules

- Stock is never below zero (BR-01, FR-INV-08), checked in the database and in the code.
- SKU is unique ignoring case and fixed after the first stock movement (BR-12).
- Every stock change writes one `stock_movements` row in the same transaction (BR-02, FR-INV-03).
- `stock_movements` and `audit_log` are append-only: no update or delete (FR-INV-03, FR-AUD-01).
- Stock-changing calls carry an `Idempotency-Key`; the key and the response are kept in `idempotency_keys` (FR-SAL-07, FR-RET-06).
- Money is `NUMERIC(12,2)` in BDT; nothing in history is hard-deleted (BR-13, BR-14).

## Where to look

| I want to…                                       | Go to                              |
| ------------------------------------------------ | ---------------------------------- |
| See how the tables connect                       | [erd.md](./erd.md)                 |
| See the constraints of one table                 | [schema.md](./schema.md) section 2 |
| Understand the stock ledger and append-only rule | [schema.md](./schema.md) section 3 |
| Understand the audit log                         | [schema.md](./schema.md) section 4 |
| Write data-integrity test cases (IMS-02.5)       | [schema.md](./schema.md) section 5 |
| Review open decisions (IMS-02.4)                 | [schema.md](./schema.md) section 6 |

## Next

The design is applied by the migrations in `backend/prisma/migrations`: the init schema (IMS-04) and the IMS-02.4 changes after the BA review. See [schema.md](./schema.md) section 8.
