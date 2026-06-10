import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parse } from "csv-parse/sync";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let count = 0;
    for (const row of records as Record<string, string>[]) {
      const accountName =
        row["Account name"] || row["Account"] || row["Account Name"] || row["Name"] || row["account_name"];
      const accountType =
        row["Account type"] || row["Type"] || row["Account Type"] || row["type"] || row["account_type"] || "";
      const detailType =
        row["Detail type"] || row["Detail Type"] || row["detail_type"] || row["DetailType"] || null;

      if (!accountName) continue;

      // Derive parent from colon separator (e.g. "Personal expenses:Federal taxes")
      let parentAccount: string | null = null;
      if (accountName.includes(":")) {
        parentAccount = accountName.split(":")[0];
      }

      await prisma.chartOfAccount.upsert({
        where: { accountName },
        update: {
          accountType,
          detailType,
          parentAccount,
          isActive: true,
        },
        create: {
          accountName,
          accountType,
          detailType,
          parentAccount,
          isActive: true,
        },
      });
      count++;
    }

    await logAudit({
      action: "chart_of_accounts_imported",
      entityType: "chart_of_accounts",
      details: `Imported ${count} accounts from ${file.name}`,
    });

    return NextResponse.json({ count, message: `Imported ${count} accounts` });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
