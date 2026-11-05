// IMS-04.2 | Seed data for local development and tests
// Covers: FR-CUS-03 (built-in Walk-in customer), SRS section 2 background
// (admin "sadia", sales staff "rafi", store staff "mitu", product KB-K120).
//
// Safe to run any number of times: every INSERT either does nothing when the
// row already exists (ON CONFLICT DO NOTHING / WHERE NOT EXISTS) or is skipped
// as a whole (the two opening purchase orders). Nothing is ever updated or deleted.
//
// Opening stock goes through the real stock path (SRS engineering spec 1.1):
// received purchase order -> products.stock_qty updated -> one stock_movements
// row per line with before/after, all in one transaction. So the stock
// reconciliation query returns 0 rows right after seeding (BR-02, FR-INV-03).
//
// Raw SQL is used on purpose: Prisma upsert cannot target the lower(sku),
// lower(username) and "one walk-in" unique indexes created in the migration.

/** The two raw-query methods this seed needs (a Prisma client or transaction client has both). */
export interface Db {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface SeedOptions {
  /** Argon2id hash used as the password of the three demo users (SRS engineering spec: Argon2id). */
  passwordHash: string;
  log?: (message: string) => void;
}

// ------------------------------------------------------------------ data

const ROLES = ['Administrator', 'Sales Staff', 'Store Staff'] as const;

const USERS = [
  { username: 'sadia', name: 'Sadia Rahman', email: 'sadia@smartmart.local', role: 'Administrator' },
  { username: 'rafi', name: 'Rafi Ahmed', email: 'rafi@smartmart.local', role: 'Sales Staff' },
  { username: 'mitu', name: 'Mitu Akter', email: 'mitu@smartmart.local', role: 'Store Staff' },
] as const;

const CATEGORIES = [
  { name: 'Keyboards', description: 'Wired and wireless keyboards' },
  { name: 'Mice', description: 'Mice and pointing devices' },
  { name: 'Monitors', description: 'Desktop monitors' },
  { name: 'Cables & Chargers', description: 'Cables, adapters and chargers' },
] as const;

// Prices in BDT. min_stock = low-stock threshold (FR-INV-07: alert when stock is strictly below it).
const PRODUCTS = [
  { sku: 'KB-K120', name: 'Logitech K120 Keyboard', category: 'Keyboards', purchase: '700.00', selling: '950.00', minStock: 10 },
  { sku: 'MS-M90', name: 'Logitech M90 Mouse', category: 'Mice', purchase: '350.00', selling: '500.00', minStock: 15 },
  { sku: 'MN-24LED', name: '24-inch LED Monitor', category: 'Monitors', purchase: '11000.00', selling: '13500.00', minStock: 5 },
  { sku: 'CB-HDMI15', name: 'HDMI Cable 1.5 m', category: 'Cables & Chargers', purchase: '120.00', selling: '200.00', minStock: 20 },
  // opening stock 6 < threshold 10, so the low-stock list (FR-INV-07) has one entry to show
  { sku: 'CH-20W', name: 'USB-C Charger 20 W', category: 'Cables & Chargers', purchase: '450.00', selling: '650.00', minStock: 10 },
] as const;

const SUPPLIERS = [
  { name: 'Tech Source BD', contact: 'Imran Hossain', phone: '01811000001', email: 'sales@techsource.example', address: 'Elephant Road, Dhaka' },
  { name: 'Digital World Ltd', contact: 'Farzana Islam', phone: '01811000002', email: 'orders@digitalworld.example', address: 'Agrabad, Chattogram' },
  { name: 'Gadget Hub', contact: 'Tanvir Alam', phone: '01811000003', email: null, address: 'Zindabazar, Sylhet' },
] as const;

const CUSTOMERS = [
  { name: 'Rahim', phone: '01711000001', email: null, address: 'Mirpur, Dhaka' },
  { name: 'Nasrin Akter', phone: '01711000002', email: 'nasrin@example.com', address: 'Uttara, Dhaka' },
] as const;

// Opening stock, received in full by the store staff (BR: a PO is received once, in full).
// qty in whole units, cost in BDT cents to avoid decimal rounding.
const OPENING_ORDERS = [
  {
    poNumber: 'PO-2026-000001',
    supplier: 'Tech Source BD',
    lines: [
      { sku: 'KB-K120', qty: 50, costCents: 70000 }, // 50 x 700.00 = 35,000.00 (SRS FR-PO-02 example)
      { sku: 'MS-M90', qty: 40, costCents: 35000 },
      { sku: 'CH-20W', qty: 6, costCents: 45000 },
    ],
  },
  {
    poNumber: 'PO-2026-000002',
    supplier: 'Digital World Ltd',
    lines: [
      { sku: 'MN-24LED', qty: 12, costCents: 1100000 },
      { sku: 'CB-HDMI15', qty: 60, costCents: 12000 },
    ],
  },
] as const;

// ------------------------------------------------------------- helpers

const cents = (n: number): string => (n / 100).toFixed(2);

async function userId(db: Db, username: string): Promise<string> {
  const rows = await db.$queryRawUnsafe<{ id: string }[]>(
    'SELECT id::text AS id FROM users WHERE lower(username) = lower($1::varchar)',
    username,
  );
  if (rows.length === 0) throw new Error(`Seed: user "${username}" was not found`);
  return rows[0].id;
}

// ---------------------------------------------------------------- seed

export async function runSeed(db: Db, options: SeedOptions): Promise<Record<string, number>> {
  const log = options.log ?? (() => undefined);

  // 1. Roles
  for (const name of ROLES) {
    await db.$executeRawUnsafe(
      'INSERT INTO roles (name) VALUES ($1::varchar) ON CONFLICT (name) DO NOTHING',
      name,
    );
  }

  // 2. Users (admin first, so the others can point to the admin as creator)
  for (const u of USERS) {
    await db.$executeRawUnsafe(
      `INSERT INTO users (name, username, email, password_hash, role_id, created_by)
       SELECT $1::varchar, $2::varchar, $3::varchar, $4::text, r.id,
              (SELECT id FROM users WHERE lower(username) = 'sadia')
         FROM roles r WHERE r.name = $5::varchar
       ON CONFLICT ((lower(username))) DO NOTHING`,
      u.name,
      u.username,
      u.email,
      options.passwordHash,
      u.role,
    );
  }
  const admin = await userId(db, 'sadia');
  const storeStaff = await userId(db, 'mitu');

  // 3. Categories
  for (const c of CATEGORIES) {
    await db.$executeRawUnsafe(
      `INSERT INTO categories (name, description, created_by)
       VALUES ($1::varchar, $2::varchar, $3::bigint)
       ON CONFLICT ((lower(name))) DO NOTHING`,
      c.name,
      c.description,
      admin,
    );
  }

  // 4. Products (stock starts at 0; opening stock comes in through the purchase orders below)
  for (const p of PRODUCTS) {
    await db.$executeRawUnsafe(
      `INSERT INTO products (sku, name, category_id, purchase_price, selling_price, min_stock, created_by)
       SELECT $1::varchar, $2::varchar, c.id, $3::numeric, $4::numeric, $5::int, $6::bigint
         FROM categories c WHERE lower(c.name) = lower($7::varchar)
       ON CONFLICT ((lower(sku))) DO NOTHING`,
      p.sku,
      p.name,
      p.purchase,
      p.selling,
      p.minStock,
      admin,
      p.category,
    );
  }

  // 5. Suppliers (no unique key in the schema, so match on name + phone)
  for (const s of SUPPLIERS) {
    await db.$executeRawUnsafe(
      `INSERT INTO suppliers (name, contact_person, phone, email, address, created_by)
       SELECT $1::varchar, $2::varchar, $3::char(11), $4::varchar, $5::varchar, $6::bigint
        WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = $1::varchar AND phone = $3::char(11))`,
      s.name,
      s.contact,
      s.phone,
      s.email,
      s.address,
      admin,
    );
  }

  // 6. Customers, including the built-in Walk-in customer (FR-CUS-03: no details, exactly one)
  for (const c of CUSTOMERS) {
    await db.$executeRawUnsafe(
      `INSERT INTO customers (name, phone, email, address, created_by)
       VALUES ($1::varchar, $2::char(11), $3::varchar, $4::varchar, $5::bigint)
       ON CONFLICT (phone) DO NOTHING`,
      c.name,
      c.phone,
      c.email,
      c.address,
      admin,
    );
  }
  await db.$executeRawUnsafe(
    `INSERT INTO customers (name, is_walk_in, created_by)
     VALUES ('Walk-in customer', true, $1::bigint)
     ON CONFLICT (is_walk_in) WHERE is_walk_in DO NOTHING`,
    admin,
  );

  // 7. Opening stock: received purchase orders, written through the stock ledger
  for (const order of OPENING_ORDERS) {
    const total = cents(order.lines.reduce((sum, l) => sum + l.qty * l.costCents, 0));
    const created = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO purchase_orders
         (po_number, supplier_id, status, order_date, expected_date, total,
          received_by, received_at, created_by)
       SELECT $1::char(14), s.id, 'RECEIVED', DATE '2026-11-02', DATE '2026-11-03', $2::numeric,
              $3::bigint, TIMESTAMPTZ '2026-11-03 10:00:00+06', $3::bigint
         FROM suppliers s WHERE s.name = $4::varchar
       ON CONFLICT (po_number) DO NOTHING
       RETURNING id::text AS id`,
      order.poNumber,
      total,
      storeStaff,
      order.supplier,
    );
    if (created.length === 0) {
      log(`  ${order.poNumber} already exists, skipped`);
      continue;
    }
    const poId = created[0].id;

    // Lock products in ascending id order (deadlock rule, SRS engineering spec 1.1 step 4)
    const lines = await db.$queryRawUnsafe<{ id: string; sku: string }[]>(
      `SELECT id::text AS id, sku FROM products WHERE lower(sku) = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      order.lines.map((l) => l.sku.toLowerCase()),
    );
    for (const row of lines) {
      const line = order.lines.find((l) => l.sku.toLowerCase() === row.sku.toLowerCase());
      if (!line) continue;
      await db.$executeRawUnsafe(
        `INSERT INTO purchase_order_lines (po_id, product_id, quantity, unit_cost)
         VALUES ($1::bigint, $2::bigint, $3::int, $4::numeric)`,
        poId,
        row.id,
        line.qty,
        cents(line.costCents),
      );
      const stock = await db.$queryRawUnsafe<{ before: number; after: number }[]>(
        `UPDATE products SET stock_qty = stock_qty + $1::int, updated_at = now()
          WHERE id = $2::bigint
          RETURNING (stock_qty - $1::int) AS before, stock_qty AS after`,
        line.qty,
        row.id,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO stock_movements
           (product_id, type, quantity, stock_before, stock_after, ref_type, ref_id, user_id)
         VALUES ($1::bigint, 'RECEIPT', $2::int, $3::int, $4::int, 'PURCHASE_ORDER', $5::bigint, $6::bigint)`,
        row.id,
        line.qty,
        stock[0].before,
        stock[0].after,
        poId,
        storeStaff,
      );
    }
    log(`  ${order.poNumber} received: ${order.lines.length} lines into stock`);
  }

  // 8. Summary
  const counts: Record<string, number> = {};
  for (const table of [
    'roles',
    'users',
    'categories',
    'products',
    'suppliers',
    'customers',
    'purchase_orders',
    'purchase_order_lines',
    'stock_movements',
  ]) {
    const rows = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${table}`);
    counts[table] = rows[0].n;
  }
  return counts;
}
