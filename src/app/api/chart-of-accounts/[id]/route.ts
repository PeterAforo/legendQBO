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

    // Prevent duplicate account names on rename
    if (body.accountName) {
      const existing = await prisma.chartOfAccount.findFirst({
        where: { accountName: body.accountName, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Account name "${body.accountName}" already exists` },
          { status: 400 }
        );
      }
    }

    const account = await prisma.chartOfAccount.update({
      where: { id },
      data: {
        ...(body.accountName !== undefined && { accountName: body.accountName }),
        ...(body.accountType !== undefined && { accountType: body.accountType }),
        ...(body.detailType !== undefined && { detailType: body.detailType || null }),
        ...(body.parentAccount !== undefined && { parentAccount: body.parentAccount || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
      },
    });

    await logAudit({
      action: "account_updated",
      entityType: "chart_of_accounts",
      entityId: id,
      details: `Updated account "${account.accountName}"`,
    });

    return NextResponse.json(account);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await prisma.chartOfAccount.findUnique({ where: { id } });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await prisma.chartOfAccount.delete({ where: { id } });

    await logAudit({
      action: "account_deleted",
      entityType: "chart_of_accounts",
      entityId: id,
      details: `Deleted account "${account.accountName}"`,
    });

    return NextResponse.json({ message: "Account deleted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
