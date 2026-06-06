import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

interface ExtractedTx {
  date: string;
  description: string;
  check_number?: string;
  money_in?: number;
  money_out?: number;
  amount: number;
  direction: string;
  section?: string;
  source_page?: number;
  raw_text?: string;
}

interface ExtractionResult {
  transactions: ExtractedTx[];
  summary: {
    total_deposits?: number;
    total_withdrawals?: number;
    total_checks?: number;
    total_fees?: number;
    opening_balance?: number;
    closing_balance?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { statementId } = await request.json();
    if (!statementId) {
      return NextResponse.json({ error: "statementId is required" }, { status: 400 });
    }

    const statement = await prisma.statementUpload.findUnique({
      where: { id: statementId },
    });
    if (!statement) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    // Update status to processing
    await prisma.statementUpload.update({
      where: { id: statementId },
      data: { uploadStatus: "processing" },
    });

    // Call Python extraction service
    const pythonScript = path.join(process.cwd(), "python", "extract_boa.py");
    let result: ExtractionResult;

    try {
      const { stdout } = await execFileAsync("python", [pythonScript, statement.filePath], {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 120000,
      });
      result = JSON.parse(stdout);
    } catch {
      // If Python fails, update status and return error
      await prisma.statementUpload.update({
        where: { id: statementId },
        data: { uploadStatus: "error", notes: "Python extraction failed" },
      });
      return NextResponse.json({ error: "PDF extraction failed. Ensure Python and dependencies are installed." }, { status: 500 });
    }

    // Get categorization rules
    const rules = await prisma.categorizationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "asc" },
      include: { account: true },
    });

    // Store transactions
    const transactions = result.transactions || [];
    let createdCount = 0;

    for (const tx of transactions) {
      const txDate = new Date(tx.date);
      const direction = tx.direction || (tx.money_in ? "Money In" : "Money Out");
      const amount = tx.amount || tx.money_in || tx.money_out || 0;

      // Apply categorization rules
      let suggestedAccountId: string | null = null;
      let suggestedAccountName: string | null = null;
      let confidence: number | null = null;
      let ruleName: string | null = null;
      let vendorPayee: string | null = null;

      for (const rule of rules) {
        if (rule.direction !== direction) continue;

        const fieldValue = getFieldValue(tx, rule.matchField);
        if (!fieldValue) continue;

        const matches = checkMatch(fieldValue, rule.condition, rule.matchValue);
        if (matches) {
          suggestedAccountId = rule.accountId;
          suggestedAccountName = rule.account.accountName;
          confidence = rule.confidence;
          ruleName = rule.name;
          vendorPayee = rule.vendorPayee;
          break;
        }
      }

      await prisma.extractedTransaction.create({
        data: {
          statementId,
          date: txDate,
          description: tx.description || "",
          checkNumber: tx.check_number || null,
          moneyIn: tx.money_in || null,
          moneyOut: tx.money_out || null,
          amount: Math.abs(amount),
          direction,
          section: tx.section || null,
          sourcePage: tx.source_page || null,
          rawText: tx.raw_text || null,
          suggestedAccountId,
          suggestedAccountName,
          confidence,
          reviewStatus: suggestedAccountId ? "pending" : "needs_review",
          ruleName,
          vendorPayee,
        },
      });
      createdCount++;
    }

    // Update statement with summary data
    const summary = result.summary || {};
    await prisma.statementUpload.update({
      where: { id: statementId },
      data: {
        uploadStatus: "extracted",
        extractionData: JSON.stringify(result),
        totalDeposits: summary.total_deposits || null,
        totalWithdrawals: summary.total_withdrawals || null,
        totalChecks: summary.total_checks || null,
        totalFees: summary.total_fees || null,
        openingBalance: summary.opening_balance || statement.openingBalance,
        closingBalance: summary.closing_balance || statement.closingBalance,
      },
    });

    await logAudit({
      action: "statement_extracted",
      entityType: "statement",
      entityId: statementId,
      details: `Extracted ${createdCount} transactions`,
    });

    return NextResponse.json({
      transactionCount: createdCount,
      message: `Extracted ${createdCount} transactions`,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function getFieldValue(tx: ExtractedTx, field: string): string {
  switch (field) {
    case "description": return tx.description || "";
    case "checkNumber": return tx.check_number || "";
    case "amount": return String(tx.amount || 0);
    case "section": return tx.section || "";
    default: return tx.description || "";
  }
}

function checkMatch(value: string, condition: string, matchValue: string): boolean {
  const v = value.toUpperCase();
  const m = matchValue.toUpperCase();
  switch (condition) {
    case "contains": return v.includes(m);
    case "startsWith": return v.startsWith(m);
    case "endsWith": return v.endsWith(m);
    case "equals": return v === m;
    default: return v.includes(m);
  }
}
