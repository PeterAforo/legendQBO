"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

const actionColors: Record<string, string> = {
  statement_uploaded: "bg-blue-100 text-blue-700",
  statement_extracted: "bg-green-100 text-green-700",
  statement_deleted: "bg-red-100 text-red-700",
  transaction_updated: "bg-yellow-100 text-yellow-700",
  transactions_bulk_updated: "bg-orange-100 text-orange-700",
  rule_created: "bg-purple-100 text-purple-700",
  rule_updated: "bg-purple-100 text-purple-700",
  rules_applied: "bg-indigo-100 text-indigo-700",
  export_generated: "bg-cyan-100 text-cyan-700",
  chart_of_accounts_imported: "bg-emerald-100 text-emerald-700",
  settings_updated: "bg-gray-100 text-gray-700",
  user_login: "bg-slate-100 text-slate-700",
};

const entityTypes = [
  { value: "all", label: "All Types" },
  { value: "statement", label: "Statements" },
  { value: "transaction", label: "Transactions" },
  { value: "rule", label: "Rules" },
  { value: "export", label: "Exports" },
  { value: "chart_of_accounts", label: "Chart of Accounts" },
  { value: "settings", label: "Settings" },
  { value: "user", label: "Users" },
];

function formatAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "30" });
      if (filterType !== "all") params.set("entityType", filterType);
      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500">
            Track all system actions and changes ({total} entries)
          </p>
        </div>
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {entityTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ScrollText className="mb-2 h-10 w-10" />
              <p className="text-sm">No audit logs yet</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Time</TableHead>
                    <TableHead className="w-48">Action</TableHead>
                    <TableHead className="w-36">Entity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-36">User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-gray-500" title={new Date(log.createdAt).toLocaleString()}>
                        {timeAgo(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={actionColors[log.action] || "bg-gray-100 text-gray-600"}>
                          {formatAction(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize text-gray-600">
                        {log.entityType}
                        {log.entityId && (
                          <span className="ml-1 text-xs text-gray-400" title={log.entityId}>
                            #{log.entityId.slice(-6)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-gray-600">
                        {log.details || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {log.user?.name || log.user?.email || "System"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4 mt-4">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
