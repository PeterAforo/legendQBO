import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    }) as Record<string, string>[];

    // Get all transactions with their categories
    const transactions = await prisma.extractedTransaction.findMany({
      orderBy: { date: "asc" },
    });

    // Build lookup by description + amount
    const txMap = new Map<string, typeof transactions[0]>();
    for (const tx of transactions) {
      const key = `${tx.description.toUpperCase().trim()}_${tx.amount}`;
      txMap.set(key, tx);
    }

    const rows = [];
    let matched = 0;
    let flagged = 0;
    let uncategorized = 0;

    for (const row of records) {
      const description =
        row["Description"] || row["description"] || row["Bank Description"] || "";
      const amount = parseFloat(
        row["Amount"] || row["Money In"] || row["Money Out"] || "0"
      );
      const qboCategory =
        row["Category"] || row["Account"] || row["QuickBooks Account"] || "";

      // Try to match with extracted transaction
      const key = `${description.toUpperCase().trim()}_${Math.abs(amount)}`;
      const matchedTx = txMap.get(key);
      const suggestedCategory = matchedTx?.suggestedAccountName || "";

      const isMatch =
        qboCategory &&
        suggestedCategory &&
        qboCategory.toLowerCase().trim() === suggestedCategory.toLowerCase().trim();

      let flag: string | null = null;
      if (!qboCategory) {
        flag = "Uncategorized in QBO";
        uncategorized++;
      } else if (!isMatch && suggestedCategory) {
        flag = "Category Mismatch";
        flagged++;
      } else if (isMatch) {
        matched++;
      }

      rows.push({
        date: row["Date"] || row["date"] || "",
        description,
        amount: Math.abs(amount),
        qboCategory,
        suggestedCategory,
        match: isMatch,
        flag,
      });
    }

    return NextResponse.json({
      rows,
      stats: {
        total: rows.length,
        matched,
        flagged,
        uncategorized,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Compare failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
