"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Statement {
  id: string;
  fileName: string;
  statementMonth: number;
  statementYear: number;
  openingBalance: number | null;
  closingBalance: number | null;
  totalDeposits: number | null;
  totalWithdrawals: number | null;
  totalChecks: number | null;
  totalFees: number | null;
}

interface ReconciliationData {
  statement: Statement;
  extracted: {
    deposits: number;
    withdrawals: number;
    checks: number;
    fees: number;
    total: number;
  };
  calculatedClosing: number;
  difference: number;
  isReconciled: boolean;
}

export default function ReconciliationPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    fetch("/api/statements")
      .then((r) => r.json())
      .then(setStatements)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setReconciling(true);
    fetch(`/api/reconciliation/${selectedId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setReconciling(false));
  }, [selectedId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reconciliation</h1>
        <p className="text-sm text-gray-500">Validate statement totals against extracted data</p>
      </div>

      <div className="flex items-center gap-4">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Select a statement..." />
          </SelectTrigger>
          <SelectContent>
            {statements.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.fileName} ({s.statementMonth}/{s.statementYear})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !selectedId ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-400">
            Select a statement to view reconciliation details
          </CardContent>
        </Card>
      ) : reconciling ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            {data.isReconciled ? (
              <Badge variant="success" className="gap-1 px-3 py-1 text-sm">
                <CheckCircle className="h-4 w-4" /> Reconciled
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1 px-3 py-1 text-sm">
                <AlertTriangle className="h-4 w-4" /> Not Reconciled
              </Badge>
            )}
            {data.difference !== 0 && (
              <span className="text-sm text-red-600">
                Difference: {formatCurrency(Math.abs(data.difference))}
              </span>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Statement Values</CardTitle>
                <CardDescription>As reported on the Bank of America statement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Row label="Opening Balance" value={data.statement.openingBalance} />
                  <Row label="Total Deposits" value={data.statement.totalDeposits} />
                  <Row label="Total Withdrawals" value={data.statement.totalWithdrawals} neg />
                  <Row label="Total Checks" value={data.statement.totalChecks} neg />
                  <Row label="Service Fees" value={data.statement.totalFees} neg />
                  <div className="border-t pt-3">
                    <Row label="Closing Balance" value={data.statement.closingBalance} bold />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Extracted Values</CardTitle>
                <CardDescription>Calculated from extracted transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Row label="Opening Balance" value={data.statement.openingBalance} />
                  <Row label="Total Deposits" value={data.extracted.deposits} />
                  <Row label="Total Withdrawals" value={data.extracted.withdrawals} neg />
                  <Row label="Total Checks" value={data.extracted.checks} neg />
                  <Row label="Service Fees" value={data.extracted.fees} neg />
                  <div className="border-t pt-3">
                    <Row label="Calculated Closing" value={data.calculatedClosing} bold />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, neg, bold }: { label: string; value: number | null | undefined; neg?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm ${neg ? "text-red-600" : ""} ${bold ? "text-base" : ""}`}>
        {value != null ? formatCurrency(value) : "—"}
      </span>
    </div>
  );
}
