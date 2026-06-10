import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // If accountId is being changed, validate
    if (body.accountId) {
      const account = await prisma.chartOfAccount.findUnique({
        where: { id: body.accountId },
      });
      if (!account) {
        return NextResponse.json(
          { error: "Selected QuickBooks account does not exist in Chart of Accounts" },
          { status: 400 }
        );
      }
    }

    const rule = await prisma.categorizationRule.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.direction !== undefined && { direction: body.direction }),
        ...(body.matchField !== undefined && { matchField: body.matchField }),
        ...(body.condition !== undefined && { condition: body.condition }),
        ...(body.matchValue !== undefined && { matchValue: body.matchValue }),
        ...(body.accountId !== undefined && { accountId: body.accountId }),
        ...(body.vendorPayee !== undefined && { vendorPayee: body.vendorPayee }),
        ...(body.autoApply !== undefined && { autoApply: body.autoApply }),
        ...(body.confidence !== undefined && { confidence: body.confidence }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: { account: { select: { accountName: true } } },
    });

    // Auto-apply updated rule to uncategorized transactions if active
    let autoApplied = 0;
    if (rule.isActive && rule.account) {
      const transactions = await prisma.extractedTransaction.findMany({
        where: {
          OR: [
            { suggestedAccountId: null },
            { reviewStatus: "needs_review" },
          ],
        },
      });

      for (const tx of transactions) {
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
          autoApplied++;
        }
      }
    }

    await logAudit({
      action: "rule_updated",
      entityType: "rule",
      entityId: id,
      details: `Updated rule "${rule.name}"${autoApplied > 0 ? `; auto-applied to ${autoApplied} transactions` : ""}`,
    });

    return NextResponse.json({ ...rule, autoApplied });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Update rule failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rule = await prisma.categorizationRule.findUnique({ where: { id } });
    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await prisma.categorizationRule.delete({ where: { id } });

    await logAudit({
      action: "rule_updated",
      entityType: "rule",
      entityId: id,
      details: `Deleted rule "${rule.name}"`,
    });

    return NextResponse.json({ message: "Rule deleted" });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Delete rule failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
