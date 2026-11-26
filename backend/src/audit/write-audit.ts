import { Prisma } from '@prisma/client';

// One row for the append-only audit_log table (FR-AUD-01).
// entity = table name (e.g. 'products'), action e.g. 'PRICE_CHANGE' or 'ADJUSTMENT' (docs/database/schema.md, section 4.1)
export interface AuditEntry {
  entity: string;
  entityId: bigint;
  action: string;
  userId: bigint;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
}

// Writes the audit row with the transaction client `tx`, so it commits or rolls back together with
// the change it describes. Call it inside prisma.$transaction(async (tx) => { ... }): if this insert
// fails, the whole change is rolled back. Never put a password hash or a token in before or after
export function writeAudit(tx: Prisma.TransactionClient, entry: AuditEntry) {
  return tx.auditLog.create({
    data: {
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId,
      beforeJson: entry.before ?? Prisma.DbNull,
      afterJson: entry.after ?? Prisma.DbNull,
    },
  });
}
