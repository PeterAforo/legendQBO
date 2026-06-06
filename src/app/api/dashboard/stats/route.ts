import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Category breakdown: top 10 accounts by transaction count
    const categoryBreakdown = await prisma.extractedTransaction.groupBy({
      by: ["suggestedAccountName"],
      _count: { id: true },
      _sum: { amount: true },
      where: { suggestedAccountName: { not: null } },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // Monthly totals: deposits vs withdrawals by statement period
    const statements = await prisma.statementUpload.findMany({
      where: { uploadStatus: "extracted" },
      select: {
        statementMonth: true,
        statementYear: true,
        totalDeposits: true,
        totalWithdrawals: true,
      },
      orderBy: [{ statementYear: "asc" }, { statementMonth: "asc" }],
    });

    // Review status distribution
    const reviewStatus = await prisma.extractedTransaction.groupBy({
      by: ["reviewStatus"],
      _count: { id: true },
    });

    // Direction breakdown
    const directionBreakdown = await prisma.extractedTransaction.groupBy({
      by: ["direction"],
      _count: { id: true },
      _sum: { amount: true },
    });

    const months = [
      "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    return NextResponse.json({
      categoryBreakdown: categoryBreakdown.map((c) => ({
        name: c.suggestedAccountName || "Uncategorized",
        count: c._count.id,
        total: c._sum.amount || 0,
      })),
      monthlyTotals: statements.map((s) => ({
        period: `${months[s.statementMonth]} ${s.statementYear}`,
        deposits: s.totalDeposits || 0,
        withdrawals: Math.abs(s.totalWithdrawals || 0),
      })),
      reviewStatus: reviewStatus.map((r) => ({
        status: r.reviewStatus,
        count: r._count.id,
      })),
      directionBreakdown: directionBreakdown.map((d) => ({
        direction: d.direction,
        count: d._count.id,
        total: d._sum.amount || 0,
      })),
    });
  } catch (error: unknown) {
    console.error("Dashboard stats error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch stats";
    return NextResponse.json({
      error: message,
      categoryBreakdown: [],
      monthlyTotals: [],
      reviewStatus: [],
      directionBreakdown: [],
    }, { status: 500 });
  }
}
