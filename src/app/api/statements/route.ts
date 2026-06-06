import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const statements = await prisma.statementUpload.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { transactions: true, exports: true } },
    },
  });
  return NextResponse.json(statements);
}
