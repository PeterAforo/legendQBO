import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const month = parseInt(formData.get("month") as string);
    const year = parseInt(formData.get("year") as string);
    const openingBalance = formData.get("openingBalance")
      ? parseFloat(formData.get("openingBalance") as string)
      : null;
    const closingBalance = formData.get("closingBalance")
      ? parseFloat(formData.get("closingBalance") as string)
      : null;

    if (!file || !month || !year) {
      return NextResponse.json(
        { error: "File, month, and year are required" },
        { status: 400 }
      );
    }

    // Save file to local storage
    const uploadDir = path.join(process.cwd(), "uploads", "statements");
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const fileName = `${year}-${String(month).padStart(2, "0")}_${timestamp}_${file.name}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Save metadata to database
    const statement = await prisma.statementUpload.create({
      data: {
        fileName: file.name,
        filePath: filePath,
        statementMonth: month,
        statementYear: year,
        openingBalance,
        closingBalance,
        uploadStatus: "uploaded",
      },
    });

    await logAudit({
      action: "statement_uploaded",
      entityType: "statement",
      entityId: statement.id,
      details: `Uploaded ${file.name} for ${year}-${String(month).padStart(2, "0")}`,
    });

    return NextResponse.json({
      id: statement.id,
      fileName: statement.fileName,
      message: "Statement uploaded successfully",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
