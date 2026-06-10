import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const accounts = await prisma.chartOfAccount.findMany({
    orderBy: { accountName: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountName, accountType, detailType, parentAccount } = body;

    if (!accountName || !accountType) {
      return NextResponse.json({ error: "accountName and accountType are required" }, { status: 400 });
    }

    const account = await prisma.chartOfAccount.create({
      data: {
        accountName,
        accountType,
        detailType: detailType || null,
        parentAccount: parentAccount || null,
      },
    });

    await logAudit({
      action: "account_created",
      entityType: "chart_of_accounts",
      entityId: account.id,
      details: `Created account "${accountName}" (${accountType})`,
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
