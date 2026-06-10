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
      const name = row["name"] || row["Name"] || "";
      if (!name) continue;

      // Look up account by name
      const accountName = row["accountName"] || row["account_name"] || row["Account Name"] || "";
      let accountId: string | undefined;
      if (accountName) {
        const acct = await prisma.chartOfAccount.findUnique({
          where: { accountName },
        });
        if (acct) accountId = acct.id;
      }

      const data = {
        name,
        direction: row["direction"] || row["Direction"] || "Money Out",
        matchField: row["matchField"] || row["match_field"] || "description",
        condition: row["condition"] || row["Condition"] || "contains",
        matchValue: row["matchValue"] || row["match_value"] || "",
        accountId: accountId || "",
        vendorPayee: row["vendorPayee"] || row["vendor_payee"] || null,
        autoApply: (row["autoApply"] || row["auto_apply"] || "true").toLowerCase() === "true",
        confidence: parseFloat(row["confidence"] || row["Confidence"] || "0.8"),
        priority: parseInt(row["priority"] || row["Priority"] || "100"),
        isActive: (row["isActive"] || row["is_active"] || "true").toLowerCase() === "true",
      };

      if (!data.accountId) {
        // Skip rules without a valid account mapping
        continue;
      }

      await prisma.categorizationRule.upsert({
        where: { name },
        update: data,
        create: data,
      });
      count++;
    }

    await logAudit({
      action: "rules_imported",
      entityType: "rule",
      details: `Imported ${count} rules from ${file.name}`,
    });

    return NextResponse.json({ count, message: `Imported ${count} rules` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
