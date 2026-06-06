import { NextResponse } from "next/server";
import { qboApiCall } from "@/lib/qbo";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    // Query all active accounts from QBO
    const result = await qboApiCall(
      "/query?query=" + encodeURIComponent("SELECT * FROM Account WHERE Active = true MAXRESULTS 1000")
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const data = result.data as {
      QueryResponse?: { Account?: Array<{
        Id: string;
        Name: string;
        AccountType: string;
        AccountSubType?: string;
        FullyQualifiedName?: string;
        Active: boolean;
      }> };
    };

    const qboAccounts = data?.QueryResponse?.Account || [];

    // Upsert accounts into our ChartOfAccount table
    let upserted = 0;
    for (const acct of qboAccounts) {
      await prisma.chartOfAccount.upsert({
        where: { accountName: acct.Name },
        create: {
          accountName: acct.Name,
          accountType: acct.AccountType,
          detailType: acct.AccountSubType || null,
          parentAccount: acct.FullyQualifiedName !== acct.Name ? acct.FullyQualifiedName?.split(":")[0] || null : null,
          isActive: acct.Active,
        },
        update: {
          accountType: acct.AccountType,
          detailType: acct.AccountSubType || null,
          isActive: acct.Active,
        },
      });
      upserted++;
    }

    await logAudit({
      action: "chart_of_accounts_imported",
      entityType: "chart_of_accounts",
      details: `Synced ${upserted} accounts from QuickBooks Online`,
    });

    return NextResponse.json({
      message: `Synced ${upserted} accounts from QuickBooks`,
      count: upserted,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync accounts failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
