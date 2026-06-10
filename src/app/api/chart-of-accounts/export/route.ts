import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stringify } from "csv-stringify/sync";

export async function GET() {
  try {
    const accounts = await prisma.chartOfAccount.findMany({
      orderBy: { accountName: "asc" },
    });

    const rows = accounts.map((a) => ({
      "Account name": a.accountName,
      "Account type": a.accountType,
      "Detail type": a.detailType || "",
      "Parent Account": a.parentAccount || "",
      Status: a.isActive ? "Active" : "Inactive",
      Notes: a.notes || "",
    }));

    const csv = stringify(rows, { header: true });

    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="chart-of-accounts-${timestamp}.csv"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
