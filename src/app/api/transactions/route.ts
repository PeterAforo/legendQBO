import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "all";
  const search = searchParams.get("search") || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  switch (filter) {
    case "uncategorized":
      where.suggestedAccountId = null;
      break;
    case "needs_review":
      where.reviewStatus = { in: ["needs_review", "needs_client"] };
      break;
    case "reviewed":
      where.reviewStatus = "reviewed";
      break;
    case "deposits":
      where.direction = "Money In";
      break;
    case "withdrawals":
      where.direction = "Money Out";
      where.section = { not: "checks" };
      break;
    case "checks":
      where.OR = [
        { section: "checks" },
        { checkNumber: { not: null } },
      ];
      break;
    case "low_confidence":
      where.confidence = { lt: 0.5 };
      break;
  }

  if (search) {
    where.OR = [
      ...(where.OR || []),
      { description: { contains: search, mode: "insensitive" } },
      { vendorPayee: { contains: search, mode: "insensitive" } },
      { checkNumber: { contains: search } },
    ];
  }

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const statementId = searchParams.get("statementId");

  if (statementId) where.statementId = statementId;

  const [transactions, total] = await Promise.all([
    prisma.extractedTransaction.findMany({
      where,
      orderBy: { date: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.extractedTransaction.count({ where }),
  ]);

  return NextResponse.json({
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
