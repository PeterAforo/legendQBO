import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stringify } from "csv-stringify/sync";

export async function GET() {
  try {
    const rules = await prisma.categorizationRule.findMany({
      orderBy: { priority: "asc" },
      include: { account: { select: { accountName: true } } },
    });

    const rows = rules.map((r) => ({
      name: r.name,
      direction: r.direction,
      matchField: r.matchField,
      condition: r.condition,
      matchValue: r.matchValue,
      accountName: r.account?.accountName || "",
      vendorPayee: r.vendorPayee || "",
      autoApply: r.autoApply ? "true" : "false",
      confidence: String(r.confidence),
      priority: String(r.priority),
      isActive: r.isActive ? "true" : "false",
    }));

    const csv = stringify(rows, { header: true });
    const timestamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="rules-${timestamp}.csv"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
