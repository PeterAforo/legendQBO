import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unlink } from "fs/promises";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const statement = await prisma.statementUpload.findUnique({
      where: { id },
      include: {
        _count: { select: { transactions: true, exports: true } },
      },
    });
    if (!statement) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }
    return NextResponse.json(statement);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch statement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const statement = await prisma.statementUpload.findUnique({
      where: { id },
      include: { _count: { select: { transactions: true } } },
    });

    if (!statement) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    // Delete the PDF file from disk
    try {
      await unlink(statement.filePath);
    } catch {
      // File may already be gone
    }

    // Cascading delete handles transactions (onDelete: Cascade in schema)
    await prisma.statementUpload.delete({ where: { id } });

    await logAudit({
      action: "statement_deleted",
      entityType: "statement",
      entityId: id,
      details: `Deleted ${statement.fileName} (${statement._count.transactions} transactions)`,
    });

    return NextResponse.json({ message: "Statement deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
