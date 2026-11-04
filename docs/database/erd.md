# SmartMart ER Diagram

| | |
|---|---|
| **Task** | IMS-02.1 Draw the ER diagram of the 14 entities |
| **Author** | Dev 1 · Md. Rashadul Islam |
| **Reviewer** | Dev 2 · MD Meherab Hossain Nowshad |
| **Source** | SRS Group 1 (SmartMart), main SRS section 5 "Data requirements" |
| **Status** | Draft for review (IMS-02.4) |

The 14 tables exactly as SRS section 5 lists them, with their key fields and links. Keys, checks and the ledger rules are in [schema.md](./schema.md). Editable source: [erd.dbml](./erd.dbml) (open it in dbdiagram.io).

![SmartMart ER diagram](./erd.png)

## Diagram (renders on GitHub)

```mermaid
erDiagram
  roles {
    int id PK
    varchar name UK "Administrator, Sales Staff, Store Staff (fixed)"
  }
  users {
    bigint id PK
    varchar name
    varchar username UK
    varchar email UK
    text password_hash
    int role FK
    boolean is_active
  }
  categories {
    int id PK
    varchar name UK "unique, ignoring case"
    varchar description
    boolean is_active
  }
  products {
    bigint id PK
    varchar sku UK
    varchar name
    int category_id FK
    decimal purchase_price "DECIMAL(12,2) >= 0"
    decimal selling_price "DECIMAL(12,2) >= 0"
    int min_stock
    int stock_qty ">= 0"
    boolean is_active
  }
  suppliers {
    bigint id PK
    varchar name "required"
    varchar contact_person
    varchar phone "required"
    varchar email
    varchar address
    boolean is_active
  }
  customers {
    bigint id PK
    varchar name
    varchar phone UK
    varchar email
    varchar address
    boolean is_active
    boolean is_walk_in "one walk-in row"
  }
  purchase_orders {
    bigint id PK
    varchar po_number UK
    bigint supplier_id FK
    varchar status "Draft, Ordered, Received, Cancelled"
    date order_date
    date expected_date
    decimal total
    bigint received_by FK
    timestamp received_at
  }
  purchase_order_lines {
    bigint id PK
    bigint po_id FK
    bigint product_id FK
    int quantity "> 0"
    decimal unit_cost ">= 0"
    decimal line_total
  }
  sales_invoices {
    bigint id PK
    varchar invoice_number UK
    bigint customer_id FK
    varchar status
    decimal total
    varchar payment_method
    bigint confirmed_by FK
    timestamp confirmed_at
    varchar idempotency_key UK
  }
  sales_invoice_lines {
    bigint id PK
    bigint invoice_id FK
    bigint product_id FK
    int quantity "> 0"
    decimal unit_price "copied at sale"
    decimal line_total
  }
  sales_returns {
    bigint id PK
    varchar return_number UK
    bigint invoice_id FK
    varchar reason
    decimal refund_total
    bigint processed_by FK
    timestamp processed_at
  }
  sales_return_lines {
    bigint id PK
    bigint return_id FK
    bigint invoice_line_id FK
    int quantity "sold minus already returned"
    varchar condition
    decimal refund_amount
  }
  stock_movements {
    bigint id PK
    bigint product_id FK
    varchar type
    int quantity
    int stock_before
    int stock_after
    varchar ref_type
    bigint ref_id
    varchar reason
    bigint user_id FK
    timestamp created_at "append-only"
  }
  audit_log {
    bigint id PK
    varchar entity
    bigint entity_id
    varchar action
    json before_json
    json after_json
    bigint user_id FK
    timestamp created_at "append-only"
  }

  roles ||--o{ users : "assigned to"
  categories ||--o{ products : "contains"
  suppliers ||--o{ purchase_orders : "supplies"
  users ||--o{ purchase_orders : "receives"
  purchase_orders ||--|{ purchase_order_lines : "has lines"
  products ||--o{ purchase_order_lines : "ordered in"
  customers ||--o{ sales_invoices : "buys"
  users ||--o{ sales_invoices : "confirms"
  sales_invoices ||--|{ sales_invoice_lines : "has lines"
  products ||--o{ sales_invoice_lines : "sold in"
  sales_invoices ||--o{ sales_returns : "returned via"
  users ||--o{ sales_returns : "processes"
  sales_returns ||--|{ sales_return_lines : "has lines"
  sales_invoice_lines ||--o{ sales_return_lines : "returned as"
  products ||--o{ stock_movements : "tracked by"
  users ||--o{ stock_movements : "records"
  users ||--o{ audit_log : "is logged in"
  purchase_orders ||..o{ stock_movements : "receipt ref"
  sales_invoices ||..o{ stock_movements : "sale ref"
  sales_returns ||..o{ stock_movements : "return ref"
```

## How to read it

- `||--o{` one to zero-or-many, e.g. one category has many products.
- `||--|{` one to one-or-many, e.g. a purchase order has at least one line.
- Dotted lines: logical link through `stock_movements.ref_type` + `ref_id`, not a real foreign key.
- `created_at`, `updated_at` and `created_by` are on every business table (section 5) but are left out of the diagram to keep it readable.

## The 14 tables

| # | Table | Links to |
|---|---|---|
| 1 | users | roles |
| 2 | roles | users |
| 3 | categories | products |
| 4 | products | categories |
| 5 | suppliers | purchase_orders |
| 6 | customers | sales_invoices |
| 7 | purchase_orders | suppliers, users |
| 8 | purchase_order_lines | purchase_orders, products |
| 9 | sales_invoices | customers, users |
| 10 | sales_invoice_lines | sales_invoices, products |
| 11 | sales_returns | sales_invoices, users |
| 12 | sales_return_lines | sales_returns, sales_invoice_lines |
| 13 | stock_movements | products, users |
| 14 | audit_log | users |
