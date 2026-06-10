import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    // Get all active rules, ordered by priority
    const rules = await prisma.categorizationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "asc" },
      include: { account: true },
    });

    // Get all uncategorized or pending transactions to re-evaluate
    const transactions = await prisma.extractedTransaction.findMany({
      where: {
        OR: [
          { suggestedAccountId: null },
          { reviewStatus: "needs_review" },
          { reviewStatus: "pending" },
        ],
      },
    });

    let updated = 0;
    for (const tx of transactions) {
      for (const rule of rules) {
        if (rule.direction !== tx.direction) continue;

        let fieldValue = "";
        switch (rule.matchField) {
          case "description": fieldValue = tx.description || ""; break;
          case "checkNumber": fieldValue = tx.checkNumber || ""; break;
          case "amount": fieldValue = String(tx.amount || 0); break;
          case "section": fieldValue = tx.section || ""; break;
          case "vendorPayee": fieldValue = tx.vendorPayee || ""; break;
          default: fieldValue = tx.description || "";
        }

        const v = fieldValue.toUpperCase();
        const m = rule.matchValue.toUpperCase();
        let matches = false;

        switch (rule.condition) {
          case "contains": matches = v.includes(m); break;
          case "startsWith": matches = v.startsWith(m); break;
          case "endsWith": matches = v.endsWith(m); break;
          case "equals": matches = v === m; break;
          default: matches = v.includes(m);
        }

        if (matches) {
          await prisma.extractedTransaction.update({
            where: { id: tx.id },
            data: {
              suggestedAccountId: rule.accountId,
              suggestedAccountName: rule.account.accountName,
              confidence: rule.confidence,
              ruleName: rule.name,
              vendorPayee: rule.vendorPayee || tx.vendorPayee,
              reviewStatus: "pending",
            },
          });
          updated++;
          break;
        }
      }
    }

    await logAudit({
      action: "rules_applied",
      entityType: "rule",
      details: `Applied rules: ${updated}/${transactions.length} transactions categorized`,
    });

    return NextResponse.json({ updated, total: transactions.length });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Apply rules failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
