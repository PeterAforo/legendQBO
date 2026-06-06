"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Statement {
  id: string;
  fileName: string;
  statementMonth: number;
  statementYear: number;
  openingBalance: number | null;
  closingBalance: number | null;
  uploadStatus: string;
  totalDeposits: number | null;
  totalWithdrawals: number | null;
  createdAt: string;
  _count?: { transactions: number; exports: number };
}

const months = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const statusColors: Record<string, string> = {
  uploaded: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  extracted: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Statement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reExtracting, setReExtracting] = useState<string | null>(null);

  async function fetchStatements() {
    try {
      const res = await fetch("/api/statements");
      const data = await res.json();
      setStatements(data);
    } catch {
      toast.error("Failed to load statements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatements();
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/statements/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success(`Deleted ${deleteTarget.fileName}`);
      setDeleteTarget(null);
      fetchStatements();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleReExtract(id: string) {
    setReExtracting(id);
    try {
      const res = await fetch("/api/statements/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Re-extracted ${data.transactionCount} transactions`);
      fetchStatements();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Re-extraction failed");
    } finally {
      setReExtracting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statement History</h1>
        <p className="text-sm text-gray-500">
          View all uploaded statements and manage extractions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Uploaded Statements ({statements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : statements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="mb-2 h-10 w-10" />
              <p className="text-sm">No statements uploaded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Deposits</TableHead>
                  <TableHead className="text-right">Withdrawals</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {months[s.statementMonth]} {s.statementYear}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-gray-600">
                      {s.fileName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusColors[s.uploadStatus] || "bg-gray-100"}
                      >
                        {s.uploadStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {s._count?.transactions ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {s.totalDeposits ? formatCurrency(s.totalDeposits) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {s.totalWithdrawals ? formatCurrency(s.totalWithdrawals) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {s.openingBalance != null ? formatCurrency(s.openingBalance) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {s.closingBalance != null ? formatCurrency(s.closingBalance) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReExtract(s.id)}
                          disabled={reExtracting === s.id}
                          title="Re-extract transactions"
                        >
                          {reExtracting === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(s)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete statement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Statement</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteTarget?.fileName}</strong>?
            This will also delete all extracted transactions and cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
