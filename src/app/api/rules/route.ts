import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const rules = await prisma.categorizationRule.findMany({
    orderBy: { priority: "asc" },
    include: { account: { select: { accountName: true } } },
  });
  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate account exists in chart of accounts
    const account = await prisma.chartOfAccount.findUnique({
      where: { id: body.accountId },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Selected QuickBooks account does not exist in Chart of Accounts" },
        { status: 400 }
      );
    }

    const rule = await prisma.categorizationRule.create({
      data: {
        name: body.name,
        direction: body.direction,
        matchField: body.matchField || "description",
        condition: body.condition || "contains",
        matchValue: body.matchValue,
        accountId: body.accountId,
        vendorPayee: body.vendorPayee || null,
        autoApply: body.autoApply ?? true,
        confidence: body.confidence ?? 0.8,
        priority: body.priority ?? 100,
      },
      include: { account: { select: { accountName: true } } },
    });

    await logAudit({
      action: "rule_created",
      entityType: "rule",
      entityId: rule.id,
      details: `Created rule "${rule.name}" → ${account.accountName}`,
    });

    return NextResponse.json(rule);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Create rule failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
