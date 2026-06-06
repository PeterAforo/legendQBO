"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BarChart3, PieChart as PieIcon } from "lucide-react";

interface ChartData {
  categoryBreakdown: { name: string; count: number; total: number }[];
  monthlyTotals: { period: string; deposits: number; withdrawals: number }[];
  reviewStatus: { status: string; count: number }[];
  directionBreakdown: { direction: string; count: number; total: number }[];
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
];

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  reviewed: "#10b981",
  needs_review: "#ef4444",
  needs_client: "#8b5cf6",
};

function formatLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function DashboardCharts() {
  const [data, setData] = useState<ChartData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Stats API error");
        return r.json();
      })
      .then((d) => {
        if (d.categoryBreakdown && d.monthlyTotals && d.reviewStatus) {
          setData(d);
        }
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const hasMonthly = data.monthlyTotals?.length > 0;
  const hasCategories = data.categoryBreakdown?.length > 0;
  const hasReview = data.reviewStatus?.length > 0;

  if (!hasMonthly && !hasCategories && !hasReview) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {hasMonthly && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Monthly Deposits vs Withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.monthlyTotals}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]} />
                <Legend />
                <Bar dataKey="deposits" fill="#10b981" name="Deposits" radius={[4, 4, 0, 0]} />
                <Bar dataKey="withdrawals" fill="#ef4444" name="Withdrawals" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasCategories && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="h-4 w-4" />
              Top Categories by Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.categoryBreakdown.slice(0, 8)}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }: { name?: string; value?: number }) =>
                    `${(name || "").length > 15 ? (name || "").slice(0, 15) + "..." : name} (${value})`
                  }
                  labelLine={false}
                >
                  {data.categoryBreakdown.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasReview && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Review Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-8">
              {data.reviewStatus.map((r) => (
                <div key={r.status} className="text-center">
                  <div
                    className="mx-auto mb-2 h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: STATUS_COLORS[r.status] || "#94a3b8" }}
                  >
                    {r.count}
                  </div>
                  <p className="text-sm font-medium text-gray-600">{formatLabel(r.status)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
