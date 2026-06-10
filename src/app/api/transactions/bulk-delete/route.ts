import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    const deleted = await prisma.extractedTransaction.deleteMany({
      where: { id: { in: ids } },
    });

    await logAudit({
      action: "transactions_bulk_updated",
      entityType: "transaction",
      details: `Bulk deleted ${deleted.count} transactions`,
    });

    return NextResponse.json({ deleted: deleted.count });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Bulk delete failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
