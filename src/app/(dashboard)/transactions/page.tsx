"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle, AlertCircle, Loader2, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Transaction {
  id: string;
  date: string;
  description: string;
  checkNumber: string | null;
  moneyIn: number | null;
  moneyOut: number | null;
  amount: number;
  direction: string;
  section: string | null;
  sourcePage: number | null;
  rawText: string | null;
  suggestedAccountName: string | null;
  suggestedAccountId: string | null;
  confidence: number | null;
  reviewStatus: string;
  ruleName: string | null;
  vendorPayee: string | null;
  notes: string | null;
  qboSyncStatus: string | null;
}

interface Account {
  id: string;
  accountName: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editAccountId, setEditAccountId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAccountId, setBulkAccountId] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statementId, setStatementId] = useState("all");
  const [statements, setStatements] = useState<{ id: string; fileName: string; statementMonth: number; statementYear: number }[]>([]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (search) params.set("search", search);
      if (statementId !== "all") params.set("statementId", statementId);
      params.set("page", page.toString());
      params.set("limit", "50");
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.transactions);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [filter, search, page, statementId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetch("/api/chart-of-accounts").then((r) => r.json()).then(setAccounts).catch(() => {});
    fetch("/api/statements").then((r) => r.json()).then(setStatements).catch(() => {});
  }, []);

  async function handleUpdateTransaction() {
    if (!editTx) return;
    try {
      await fetch(`/api/transactions/${editTx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestedAccountId: editAccountId || null,
          notes: editNotes,
          reviewStatus: "reviewed",
          isManual: true,
        }),
      });
      setEditTx(null);
      toast.success("Transaction updated");
      fetchTransactions();
    } catch {
      toast.error("Update failed");
    }
  }

  async function handleBulkUpdate() {
    if (selectedIds.size === 0 || !bulkAccountId) return;
    try {
      await fetch("/api/transactions/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          suggestedAccountId: bulkAccountId,
          reviewStatus: "reviewed",
        }),
      });
      setSelectedIds(new Set());
      setBulkAccountId("");
      toast.success(`Updated ${selectedIds.size} transactions`);
      fetchTransactions();
    } catch {
      toast.error("Bulk update failed");
    }
  }

  async function handleMarkReviewed(id: string) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus: "reviewed" }),
    });
    fetchTransactions();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  }

  async function handlePushToQbo() {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/qbo/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push failed");
      toast.success(data.message);
      if (data.failed > 0) {
        toast.warning(`${data.failed} transactions failed to push`);
      }
      setSelectedIds(new Set());
      fetchTransactions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Push to QBO failed");
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "reviewed": return "success";
      case "needs_review": return "warning";
      case "needs_client": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="text-sm text-gray-500">Review and categorize extracted transactions</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-base">
              {total} Transactions {totalPages > 1 && `(page ${page}/${totalPages})`}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="deposits">Deposits</SelectItem>
                  <SelectItem value="withdrawals">Withdrawals</SelectItem>
                  <SelectItem value="checks">Checks</SelectItem>
                  <SelectItem value="low_confidence">Low Confidence</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statementId} onValueChange={(v) => { setStatementId(v); setPage(1); }}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="All Statements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statements</SelectItem>
                  {statements.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.statementMonth}/{s.statementYear} — {s.fileName.slice(0, 20)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedIds.size > 0 && (
            <div className="mt-3 flex items-center gap-3 rounded-md bg-blue-50 p-3">
              <span className="text-sm font-medium text-blue-700">
                {selectedIds.size} selected
              </span>
              <Select value={bulkAccountId} onValueChange={setBulkAccountId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Assign category..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleBulkUpdate} disabled={!bulkAccountId}>
                Apply
              </Button>
              <div className="ml-auto">
                <Button size="sm" variant="outline" onClick={handlePushToQbo}>
                  Push to QBO
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No transactions found. Upload a statement first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === transactions.length && transactions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Check #</TableHead>
                    <TableHead className="text-right">Money In</TableHead>
                    <TableHead className="text-right">Money Out</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Vendor/Payee</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>QBO</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={() => toggleSelect(tx.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm" title={tx.description}>
                        {tx.description}
                      </TableCell>
                      <TableCell className="text-sm">{tx.checkNumber || "—"}</TableCell>
                      <TableCell className="text-right text-sm text-green-600">
                        {tx.moneyIn ? formatCurrency(tx.moneyIn) : ""}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600">
                        {tx.moneyOut ? formatCurrency(tx.moneyOut) : ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.suggestedAccountName || (
                          <span className="text-gray-400 italic">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{tx.vendorPayee || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-500">{tx.ruleName || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {tx.confidence != null ? (
                          <span
                            className={
                              tx.confidence >= 0.8
                                ? "text-green-600"
                                : tx.confidence >= 0.5
                                ? "text-yellow-600"
                                : "text-red-600"
                            }
                          >
                            {Math.round(tx.confidence * 100)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(tx.reviewStatus) as "default" | "secondary" | "destructive" | "success" | "warning"}>
                          {tx.reviewStatus.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tx.qboSyncStatus === "synced" ? (
                          <Badge variant="success">Synced</Badge>
                        ) : tx.qboSyncStatus === "failed" ? (
                          <Badge variant="destructive">Failed</Badge>
                        ) : tx.qboSyncStatus === "pending" ? (
                          <Badge variant="warning">Pending</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{tx.sourcePage || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditTx(tx);
                              setEditAccountId(tx.suggestedAccountId || "");
                              setEditNotes(tx.notes || "");
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {tx.reviewStatus !== "reviewed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkReviewed(tx.id)}
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 mt-4">
              <p className="text-sm text-gray-500">Showing {transactions.length} of {total}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editTx} onOpenChange={() => setEditTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {editTx && (
            <div className="space-y-4">
              <div className="rounded-md bg-gray-50 p-3 text-sm">
                <p className="font-medium">{editTx.description}</p>
                <p className="text-gray-500">
                  {formatDate(editTx.date)} &middot;{" "}
                  {editTx.moneyIn ? `In: ${formatCurrency(editTx.moneyIn)}` : ""}{" "}
                  {editTx.moneyOut ? `Out: ${formatCurrency(editTx.moneyOut)}` : ""}
                </p>
                {editTx.rawText && (
                  <p className="mt-2 text-xs text-gray-400">Raw: {editTx.rawText}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>QuickBooks Account</Label>
                <Select value={editAccountId} onValueChange={setEditAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Input
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTx(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTransaction}>Save &amp; Mark Reviewed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
