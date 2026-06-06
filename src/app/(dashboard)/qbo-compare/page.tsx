"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, GitCompare, Loader2, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CompareRow {
  date: string;
  description: string;
  amount: number;
  qboCategory: string;
  suggestedCategory: string;
  match: boolean;
  flag: string | null;
}

export default function QBOComparePage() {
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [stats, setStats] = useState<{ total: number; matched: number; flagged: number; uncategorized: number } | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/qbo-compare", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Compare failed");

      setRows(data.rows);
      setStats(data.stats);
      setMessage({ type: "success", text: `Compared ${data.stats.total} rows` });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Compare failed";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadCorrections() {
    const res = await fetch("/api/qbo-compare/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: rows.filter((r) => !r.match) }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "correction-worksheet.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const flaggedRows = rows.filter((r) => !r.match);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">QBO Comparison</h1>
          <p className="text-sm text-gray-500">Compare QuickBooks Online categories with system suggestions</p>
        </div>
        <div className="flex gap-3">
          {flaggedRows.length > 0 && (
            <Button variant="outline" onClick={handleDownloadCorrections}>
              <Download className="h-4 w-4" /> Correction Worksheet
            </Button>
          )}
          <label htmlFor="qbo-upload">
            <Button asChild disabled={loading}>
              <span>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload QBO CSV
              </span>
            </Button>
          </label>
          <input id="qbo-upload" type="file" accept=".csv" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-gray-500">Total</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{stats.matched}</p><p className="text-xs text-gray-500">Matched</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{stats.flagged}</p><p className="text-xs text-gray-500">Flagged</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{stats.uncategorized}</p><p className="text-xs text-gray-500">Uncategorized</p></CardContent></Card>
        </div>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompare className="h-4 w-4" />
              Comparison Results ({rows.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>QBO Category</TableHead>
                  <TableHead>Suggested Category</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i} className={!row.match ? "bg-red-50/50" : ""}>
                    <TableCell className="text-sm">{row.date}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{row.description}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(row.amount)}</TableCell>
                    <TableCell className="text-sm">{row.qboCategory || <span className="italic text-gray-400">None</span>}</TableCell>
                    <TableCell className="text-sm">{row.suggestedCategory || <span className="italic text-gray-400">None</span>}</TableCell>
                    <TableCell>
                      {row.match ? (
                        <Badge variant="success">Match</Badge>
                      ) : (
                        <Badge variant="destructive">{row.flag || "Mismatch"}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-400">
            Upload a CSV exported from QuickBooks Online Bank Transactions to compare categories.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
