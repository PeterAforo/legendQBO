import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const statement = await prisma.statementUpload.findUnique({
      where: { id },
    });
    if (!statement) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    // Calculate extracted totals
    const transactions = await prisma.extractedTransaction.findMany({
      where: { statementId: id },
    });

    const extracted = {
      deposits: 0,
      withdrawals: 0,
      checks: 0,
      fees: 0,
      total: 0,
    };

    for (const tx of transactions) {
      if (tx.direction === "Money In") {
        extracted.deposits += tx.moneyIn || tx.amount || 0;
      } else {
        const section = (tx.section || "").toLowerCase();
        if (section === "checks" || tx.checkNumber) {
          extracted.checks += tx.moneyOut || tx.amount || 0;
        } else if (section === "fees" || section === "service fees" || section === "service_fees") {
          extracted.fees += tx.moneyOut || tx.amount || 0;
        } else {
          extracted.withdrawals += tx.moneyOut || tx.amount || 0;
        }
      }
    }

    // Round values
    extracted.deposits = Math.round(extracted.deposits * 100) / 100;
    extracted.withdrawals = Math.round(extracted.withdrawals * 100) / 100;
    extracted.checks = Math.round(extracted.checks * 100) / 100;
    extracted.fees = Math.round(extracted.fees * 100) / 100;

    const openingBalance = statement.openingBalance || 0;
    const calculatedClosing =
      Math.round(
        (openingBalance + extracted.deposits - extracted.withdrawals - extracted.checks - extracted.fees) * 100
      ) / 100;

    const difference = statement.closingBalance
      ? Math.round((calculatedClosing - statement.closingBalance) * 100) / 100
      : 0;

    const isReconciled = Math.abs(difference) < 0.01;

    return NextResponse.json({
      statement,
      extracted,
      calculatedClosing,
      difference,
      isReconciled,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Reconciliation failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
