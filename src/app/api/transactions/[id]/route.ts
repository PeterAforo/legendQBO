import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // If account is being set, validate it exists in chart of accounts
    if (body.suggestedAccountId) {
      const account = await prisma.chartOfAccount.findUnique({
        where: { id: body.suggestedAccountId },
      });
      if (!account) {
        return NextResponse.json(
          { error: "Account does not exist in Chart of Accounts" },
          { status: 400 }
        );
      }
      body.suggestedAccountName = account.accountName;
    }

    const transaction = await prisma.extractedTransaction.update({
      where: { id },
      data: {
        ...(body.suggestedAccountId !== undefined && {
          suggestedAccountId: body.suggestedAccountId,
          suggestedAccountName: body.suggestedAccountName || null,
        }),
        ...(body.reviewStatus && { reviewStatus: body.reviewStatus }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.isManual !== undefined && { isManual: body.isManual }),
      },
    });

    return NextResponse.json(transaction);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
