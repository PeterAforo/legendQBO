import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { stringify } from "csv-stringify/sync";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";

function getExportDir() {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "uploads", "exports");
  }
  return path.join(process.cwd(), "uploads", "exports");
}

export async function POST(request: NextRequest) {
  try {
    const { statementId, exportType } = await request.json();

    if (!statementId || !exportType) {
      return NextResponse.json(
        { error: "statementId and exportType are required" },
        { status: 400 }
      );
    }

    const transactions = await prisma.extractedTransaction.findMany({
      where: { statementId },
      orderBy: { date: "asc" },
    });

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found for this statement" },
        { status: 404 }
      );
    }

    let csvContent: string;
    let fileName: string;
    const timestamp = new Date().toISOString().slice(0, 10);

    switch (exportType) {
      case "qbo_bank_upload": {
        const rows = transactions.map((tx) => ({
          Date: formatQboDate(tx.date),
          "Bank description": formatBankDescription(tx),
          Spent: tx.moneyOut ? formatQboAmount(tx.moneyOut) : "",
          Received: tx.moneyIn ? formatQboAmount(tx.moneyIn) : "",
          "From/To": tx.vendorPayee || "",
          "Match/Categorize": tx.suggestedAccountName || "",
        }));
        csvContent = stringify(rows, { header: true, quoted: true });
        fileName = `qbo-bank-upload-${timestamp}.csv`;
        break;
      }

      case "categorization_review": {
        const rows = transactions.map((tx) => ({
          Date: new Date(tx.date).toLocaleDateString("en-US"),
          Description: tx.description,
          "Money In": tx.moneyIn || "",
          "Money Out": tx.moneyOut || "",
          "Check Number": tx.checkNumber || "",
          "QuickBooks Account": tx.suggestedAccountName || "",
          "Vendor/Payee": tx.vendorPayee || "",
          "Rule Name": tx.ruleName || "",
          "Transaction Type": tx.direction,
          Notes: tx.notes || "",
        }));
        csvContent = stringify(rows, { header: true });
        fileName = `categorization-review-${timestamp}.csv`;
        break;
      }

      case "audit": {
        const rows = transactions.map((tx) => ({
          Date: new Date(tx.date).toLocaleDateString("en-US"),
          Description: tx.description,
          Amount: tx.amount,
          Direction: tx.direction,
          Section: tx.section || "",
          "Source Page": tx.sourcePage || "",
          "Raw Text": tx.rawText || "",
          Category: tx.suggestedAccountName || "",
          Confidence: tx.confidence != null ? Math.round(tx.confidence * 100) + "%" : "",
          "Review Status": tx.reviewStatus,
        }));
        csvContent = stringify(rows, { header: true });
        fileName = `audit-export-${timestamp}.csv`;
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    // Save export file
    const exportDir = getExportDir();
    await mkdir(exportDir, { recursive: true });
    const filePath = path.join(exportDir, fileName);
    await writeFile(filePath, csvContent);

    // Store export record
    const exportRecord = await prisma.exportFile.create({
      data: {
        statementId,
        exportType,
        fileName,
        filePath,
        recordCount: transactions.length,
      },
    });

    await logAudit({
      action: "export_generated",
      entityType: "export",
      entityId: exportRecord.id,
      details: `Generated ${exportType} CSV with ${transactions.length} records`,
    });

    // Return CSV as download
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * Format date as MM/DD/YYYY with zero padding for QBO.
 */
function formatQboDate(date: Date | string): string {
  const d = new Date(date);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Format amount as $1,234.00 for QBO.
 */
function formatQboAmount(amount: number): string {
  return "$" + amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface TxRecord {
  description: string;
  checkNumber?: string | null;
  section?: string | null;
  vendorPayee?: string | null;
  direction: string;
}

/**
 * Generate a clean "Bank description" for QBO import.
 * Matches the format QBO expects: simplified payee-style descriptions.
 */
function formatBankDescription(tx: TxRecord): string {
  const desc = tx.description || "";

  // Checks: "Check 2058"
  if (tx.section === "Checks" || tx.checkNumber) {
    const num = tx.checkNumber || desc.match(/#(\d+)/)?.[1];
    return num ? `Check ${num}` : "Check";
  }

  // Zelle: "Zelle from Name" or "Zelle to Name"
  const zelleMatch = desc.match(/^Zelle payment (to|from)\s+(.+?)(\s+for\s+|;|$)/);
  if (zelleMatch) {
    return `Zelle ${zelleMatch[1]} ${zelleMatch[2].trim()}`;
  }

  // Online Banking transfer: "Transfer from SAV 5806"
  const transferMatch = desc.match(/^Online Banking transfer from (\w+\s+\d+)/);
  if (transferMatch) {
    return `Transfer from ${transferMatch[1]}`;
  }

  // ATM deposit: "BKOFAMERICA ATM DEPOSIT"
  if (/^BKOFAMERICA ATM/.test(desc)) {
    return "BKOFAMERICA ATM DEPOSIT";
  }

  // Mobile deposit: "BKOFAMERICA MOBILE DEPOSIT"
  if (/^BKOFAMERICA MOBILE/.test(desc)) {
    return "BKOFAMERICA MOBILE DEPOSIT";
  }

  // Branch credit: "Bc Fr Chkg"
  if (/^BKOFAMERICA BC/.test(desc)) {
    return "Bc Fr Chkg";
  }

  // Counter Credit
  if (/^Counter Credit/i.test(desc)) {
    return "Counter Credit";
  }

  // CHECKCARD with merchant: extract merchant name
  const cardMatch = desc.match(/^CHECKCARD\s+\d{4}\s+(.+?)\s{2,}/);
  if (cardMatch) {
    return cardMatch[1].trim();
  }

  // ACH with INDN: use individual name
  const achIndnMatch = desc.match(/^(.+?)\s+DES:.+?INDN:(.+?)\s{2,}/);
  if (achIndnMatch) {
    return achIndnMatch[1].trim();
  }

  // ACH without INDN: use company name
  const achMatch = desc.match(/^(.+?)\s+DES:/);
  if (achMatch) {
    return achMatch[1].trim();
  }

  // PURCHASE: extract merchant before date
  const purchaseMatch = desc.match(/^(.+?)\s+\d{2}\/\d{2}\s+#\d+\s+PURCHASE/);
  if (purchaseMatch) {
    return purchaseMatch[1].trim();
  }

  // Service fees
  if (/^Excess Transaction Fee/i.test(desc)) {
    return "Excess Transaction Fee";
  }

  // Fallback: use vendorPayee or first ~40 chars of description
  return tx.vendorPayee || desc.slice(0, 40).trim();
}
