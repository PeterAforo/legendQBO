import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const { ids, suggestedAccountId, reviewStatus } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    // Validate account exists
    let accountName: string | null = null;
    if (suggestedAccountId) {
      const account = await prisma.chartOfAccount.findUnique({
        where: { id: suggestedAccountId },
      });
      if (!account) {
        return NextResponse.json(
          { error: "Account does not exist in Chart of Accounts" },
          { status: 400 }
        );
      }
      accountName = account.accountName;
    }

    const updated = await prisma.extractedTransaction.updateMany({
      where: { id: { in: ids } },
      data: {
        ...(suggestedAccountId && {
          suggestedAccountId,
          suggestedAccountName: accountName,
        }),
        ...(reviewStatus && { reviewStatus }),
        isManual: true,
      },
    });

    await logAudit({
      action: "transactions_bulk_updated",
      entityType: "transaction",
      details: `Bulk updated ${updated.count} transactions${accountName ? ` → ${accountName}` : ""}`,
    });

    return NextResponse.json({ updated: updated.count });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Bulk update failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
