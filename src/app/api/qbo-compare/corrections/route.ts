import { NextRequest, NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";

interface CorrectionRow {
  date: string;
  description: string;
  amount: number;
  qboCategory: string;
  suggestedCategory: string;
  flag: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { rows } = (await request.json()) as { rows: CorrectionRow[] };

    const csvRows = rows.map((r) => ({
      Date: r.date,
      Description: r.description,
      Amount: r.amount,
      "Current QBO Category": r.qboCategory || "",
      "Suggested Category": r.suggestedCategory || "",
      Issue: r.flag || "",
      "Corrected Category": "",
      Notes: "",
    }));

    const csv = stringify(csvRows, { header: true });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="correction-worksheet.csv"',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to generate corrections";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
