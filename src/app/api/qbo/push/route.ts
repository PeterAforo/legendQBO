import { NextRequest, NextResponse } from "next/server";
import { qboApiCall } from "@/lib/qbo";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const { transactionIds } = await request.json();

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: "No transaction IDs provided" }, { status: 400 });
    }

    // Fetch transactions with their account mappings
    const transactions = await prisma.extractedTransaction.findMany({
      where: {
        id: { in: transactionIds },
        qboSyncStatus: { not: "synced" },
      },
      include: {
        suggestedAccount: true,
      },
    });

    if (transactions.length === 0) {
      return NextResponse.json({ error: "No eligible transactions to push" }, { status: 400 });
    }

    // We need to find/get the bank account in QBO
    // Query for the checking account
    const bankAccountResult = await qboApiCall(
      "/query?query=" + encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Bank' AND AccountSubType = 'Checking' MAXRESULTS 5")
    );

    if (!bankAccountResult.ok) {
      return NextResponse.json({ error: "Failed to find bank account in QBO" }, { status: 500 });
    }

    const bankAccounts = (bankAccountResult.data as {
      QueryResponse?: { Account?: Array<{ Id: string; Name: string }> };
    })?.QueryResponse?.Account || [];

    if (bankAccounts.length === 0) {
      return NextResponse.json({ error: "No checking account found in QBO" }, { status: 400 });
    }

    const bankAccountId = bankAccounts[0].Id;

    // Map local account names to QBO account IDs
    const accountNameToQboId = new Map<string, string>();

    // Query all accounts from QBO for mapping
    const allAccountsResult = await qboApiCall(
      "/query?query=" + encodeURIComponent("SELECT Id, Name FROM Account WHERE Active = true MAXRESULTS 1000")
    );

    if (allAccountsResult.ok) {
      const accounts = (allAccountsResult.data as {
        QueryResponse?: { Account?: Array<{ Id: string; Name: string }> };
      })?.QueryResponse?.Account || [];
      for (const a of accounts) {
        accountNameToQboId.set(a.Name.toLowerCase(), a.Id);
      }
    }

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const tx of transactions) {
      try {
        // Find the QBO account ID for this transaction's category
        const categoryName = tx.suggestedAccount?.accountName;
        let categoryAccountId: string | undefined;

        if (categoryName) {
          categoryAccountId = accountNameToQboId.get(categoryName.toLowerCase());
        }

        if (!categoryAccountId) {
          // Use "Uncategorized Expense" or "Uncategorized Income" as fallback
          const fallback = tx.direction === "Money Out" ? "uncategorized expense" : "uncategorized income";
          categoryAccountId = accountNameToQboId.get(fallback);
        }

        if (!categoryAccountId) {
          errors.push(`No QBO account found for "${categoryName || "uncategorized"}" (tx: ${tx.description.slice(0, 30)})`);
          await prisma.extractedTransaction.update({
            where: { id: tx.id },
            data: { qboSyncStatus: "failed" },
          });
          failed++;
          continue;
        }

        const txDate = tx.date.toISOString().split("T")[0]; // YYYY-MM-DD

        let result;

        if (tx.direction === "Money Out") {
          // Create a Purchase (expense)
          result = await qboApiCall("/purchase", {
            method: "POST",
            body: {
              PaymentType: tx.checkNumber ? "Check" : "Cash",
              AccountRef: { value: bankAccountId },
              TxnDate: txDate,
              Line: [
                {
                  Amount: Math.abs(tx.amount),
                  DetailType: "AccountBasedExpenseLineDetail",
                  AccountBasedExpenseLineDetail: {
                    AccountRef: { value: categoryAccountId },
                  },
                  Description: tx.description,
                },
              ],
              DocNumber: tx.checkNumber || undefined,
              PrivateNote: tx.notes || tx.description,
              ...(tx.vendorPayee ? { EntityRef: { value: tx.vendorPayee, type: "Vendor" } } : {}),
            },
          });
        } else {
          // Create a Deposit
          result = await qboApiCall("/deposit", {
            method: "POST",
            body: {
              DepositToAccountRef: { value: bankAccountId },
              TxnDate: txDate,
              Line: [
                {
                  Amount: Math.abs(tx.amount),
                  DetailType: "DepositLineDetail",
                  DepositLineDetail: {
                    AccountRef: { value: categoryAccountId },
                  },
                  Description: tx.description,
                },
              ],
              PrivateNote: tx.notes || tx.description,
            },
          });
        }

        if (result.ok && result.data) {
          const responseData = result.data as { Purchase?: { Id: string }; Deposit?: { Id: string } };
          const qboTxnId = responseData.Purchase?.Id || responseData.Deposit?.Id || null;

          await prisma.extractedTransaction.update({
            where: { id: tx.id },
            data: {
              qboSyncStatus: "synced",
              qboTxnId,
              qboSyncedAt: new Date(),
            },
          });
          synced++;
        } else {
          errors.push(`Failed to push "${tx.description.slice(0, 30)}": ${result.error}`);
          await prisma.extractedTransaction.update({
            where: { id: tx.id },
            data: { qboSyncStatus: "failed" },
          });
          failed++;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error pushing "${tx.description.slice(0, 30)}": ${errMsg}`);
        await prisma.extractedTransaction.update({
          where: { id: tx.id },
          data: { qboSyncStatus: "failed" },
        });
        failed++;
      }
    }

    await logAudit({
      action: "qbo_push",
      entityType: "qbo_push",
      details: `Pushed ${synced} transactions to QBO (${failed} failed)`,
    });

    return NextResponse.json({
      message: `Pushed ${synced} transactions to QuickBooks`,
      synced,
      failed,
      errors: errors.slice(0, 10),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Push to QBO failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
