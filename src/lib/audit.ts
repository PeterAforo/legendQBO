import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "statement_uploaded"
  | "statement_extracted"
  | "statement_deleted"
  | "transaction_updated"
  | "transactions_bulk_updated"
  | "rule_created"
  | "rule_updated"
  | "rules_applied"
  | "rules_imported"
  | "export_generated"
  | "chart_of_accounts_imported"
  | "account_created"
  | "account_updated"
  | "account_deleted"
  | "settings_updated"
  | "user_login"
  | "qbo_push";

export async function logAudit(params: {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  details?: string;
  userId?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        details: params.details ?? null,
        userId: params.userId ?? null,
      },
    });
  } catch {
    // Audit logging should never break the main flow
    console.error("Failed to write audit log:", params.action);
  }
}
