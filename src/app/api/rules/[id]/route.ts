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

    await logAudit({
      action: "rule_updated",
      entityType: "rule",
      entityId: id,
      details: `Updated rule "${rule.name}"`,
    });

    return NextResponse.json(rule);
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
