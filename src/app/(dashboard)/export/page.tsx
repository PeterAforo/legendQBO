"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Statement {
  id: string;
  fileName: string;
  statementMonth: number;
  statementYear: number;
}

interface ExportRecord {
  id: string;
  exportType: string;
  fileName: string;
  recordCount: number;
  createdAt: string;
}

export default function ExportPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/statements").then((r) => r.json()),
      fetch("/api/exports").then((r) => r.json()),
    ])
      .then(([stmts, exps]) => {
        setStatements(stmts);
        setExports(exps);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleExport(type: string) {
    const hasStatement = !!selectedId;
    const hasRange = !!fromDate && !!toDate;
    if (!hasStatement && !hasRange) {
      toast.error("Select a statement or provide a date range");
      return;
    }
    setExporting(type);
    try {
      const payload: Record<string, string> = { exportType: type };
      if (selectedId) payload.statementId = selectedId;
      if (fromDate) payload.fromDate = fromDate;
      if (toDate) payload.toDate = toDate;

      const res = await fetch("/api/exports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const fileName = disposition?.match(/filename="(.+)"/)?.[1] || `export-${type}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${type.replace(/_/g, " ")} CSV`);

      // Refresh exports list
      const expsRes = await fetch("/api/exports");
      setExports(await expsRes.json());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const exportTypes = [
    {
      type: "qbo_bank_upload",
      title: "QBO Bank Upload CSV",
      description: "Date, Bank description, Spent, Received, From/To, Match/Categorize — ready for QBO bank upload",
    },
    {
      type: "categorization_review",
      title: "Categorization Review CSV",
      description: "Full review export with categories, rules, vendor/payee, and notes",
    },
    {
      type: "audit",
      title: "Audit CSV",
      description: "Complete audit trail with raw text, source page, confidence, and review status",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export</h1>
        <p className="text-sm text-gray-500">Generate QuickBooks-ready CSV files by statement or date range</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Statement</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-72">
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
        <div className="text-sm text-gray-400 pb-2">or</div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">From</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">To</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {exportTypes.map((exp) => (
          <Card key={exp.type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                {exp.title}
              </CardTitle>
              <CardDescription className="text-xs">{exp.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleExport(exp.type)}
                disabled={(!selectedId && (!fromDate || !toDate)) || exporting === exp.type}
                className="w-full"
              >
                {exporting === exp.type ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : exports.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No exports yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-16">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="font-medium">{exp.fileName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{exp.exportType.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>{exp.recordCount}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = `/api/exports/${exp.id}/download`;
                          a.download = exp.fileName;
                          a.click();
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
