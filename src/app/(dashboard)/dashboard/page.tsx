export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Download,
  Scale,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DashboardCharts } from "@/components/dashboard/charts";
import { QuickActions } from "@/components/dashboard/quick-actions";

async function getDashboardStats() {
  const [
    totalStatements,
    totalTransactions,
    categorizedCount,
    uncategorizedCount,
    needsReviewCount,
    latestExports,
    latestStatements,
  ] = await Promise.all([
    prisma.statementUpload.count(),
    prisma.extractedTransaction.count(),
    prisma.extractedTransaction.count({
      where: { suggestedAccountId: { not: null }, reviewStatus: "reviewed" },
    }),
    prisma.extractedTransaction.count({
      where: { suggestedAccountId: null },
    }),
    prisma.extractedTransaction.count({
      where: { reviewStatus: { in: ["needs_review", "needs_client"] } },
    }),
    prisma.exportFile.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.statementUpload.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { transactions: true } } },
    }),
  ]);

  return {
    totalStatements,
    totalTransactions,
    categorizedCount,
    uncategorizedCount,
    needsReviewCount,
    latestExports,
    latestStatements,
  };
}

export default async function DashboardPage() {
  let stats;
  try {
    stats = await getDashboardStats();
  } catch (error) {
    console.error("Dashboard stats error:", error);
    stats = {
      totalStatements: 0,
      totalTransactions: 0,
      categorizedCount: 0,
      uncategorizedCount: 0,
      needsReviewCount: 0,
      latestExports: [] as Awaited<ReturnType<typeof getDashboardStats>>["latestExports"],
      latestStatements: [] as Awaited<ReturnType<typeof getDashboardStats>>["latestStatements"],
    };
  }

  const cards = [
    {
      title: "Uploaded Statements",
      value: stats.totalStatements,
      icon: Upload,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Total Transactions",
      value: stats.totalTransactions,
      icon: FileText,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Categorized",
      value: stats.categorizedCount,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Uncategorized",
      value: stats.uncategorizedCount,
      icon: AlertCircle,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      title: "Needs Review",
      value: stats.needsReviewCount,
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Total Exports",
      value: stats.latestExports.length,
      icon: Download,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Legends Homecare LLC &mdash; Bank of America Statement Overview
        </p>
      </div>

      <QuickActions />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`rounded-lg p-3 ${card.bg}`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DashboardCharts />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Recent Statements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.latestStatements.length === 0 ? (
              <p className="text-sm text-gray-400">No statements uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {stats.latestStatements.map((stmt) => (
                  <div
                    key={stmt.id}
                    className="flex items-center justify-between rounded-md border border-gray-100 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{stmt.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {stmt.statementMonth}/{stmt.statementYear} &middot;{" "}
                        {stmt._count.transactions} transactions
                      </p>
                    </div>
                    <Badge
                      variant={
                        stmt.uploadStatus === "extracted"
                          ? "success"
                          : stmt.uploadStatus === "error"
                          ? "destructive"
                          : "default"
                      }
                    >
                      {stmt.uploadStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              Recent Exports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.latestExports.length === 0 ? (
              <p className="text-sm text-gray-400">No exports yet.</p>
            ) : (
              <div className="space-y-3">
                {stats.latestExports.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between rounded-md border border-gray-100 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{exp.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {exp.exportType} &middot; {exp.recordCount} records
                      </p>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
