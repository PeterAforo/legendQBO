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
          Date: new Date(tx.date).toLocaleDateString("en-US"),
          Description: tx.description,
          "Money In": tx.moneyIn || "",
          "Money Out": tx.moneyOut || "",
        }));
        csvContent = stringify(rows, { header: true });
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
