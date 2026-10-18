import "server-only";
import { db, schema, type DbOrTx } from "@/db";

export interface AuditInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
}

/** Append-only audit trail. Never put secrets or full personal data in `meta`. */
export async function writeAudit(input: AuditInput, tx: DbOrTx = db) {
  await tx.insert(schema.auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    reason: input.reason ?? null,
    safeMetadata: input.meta ?? null,
  });
}
