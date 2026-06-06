"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Play, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Rule {
  id: string;
  name: string;
  direction: string;
  matchField: string;
  condition: string;
  matchValue: string;
  accountId: string;
  account: { accountName: string };
  vendorPayee: string | null;
  autoApply: boolean;
  confidence: number;
  priority: number;
  isActive: boolean;
}

interface Account {
  id: string;
  accountName: string;
}

const EMPTY_RULE = {
  name: "",
  direction: "Money Out",
  matchField: "description",
  condition: "contains",
  matchValue: "",
  accountId: "",
  vendorPayee: "",
  autoApply: true,
  confidence: 0.8,
  priority: 100,
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [applying, setApplying] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchRules();
    fetch("/api/chart-of-accounts").then((r) => r.json()).then(setAccounts).catch(() => {});
  }, []);

  async function fetchRules() {
    try {
      const res = await fetch("/api/rules");
      setRules(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_RULE);
    setShowDialog(true);
  }

  function openEdit(rule: Rule) {
    setEditId(rule.id);
    setForm({
      name: rule.name,
      direction: rule.direction,
      matchField: rule.matchField,
      condition: rule.condition,
      matchValue: rule.matchValue,
      accountId: rule.accountId,
      vendorPayee: rule.vendorPayee || "",
      autoApply: rule.autoApply,
      confidence: rule.confidence,
      priority: rule.priority,
    });
    setShowDialog(true);
  }

  async function handleSave() {
    try {
      const url = editId ? `/api/rules/${editId}` : "/api/rules";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save rule");
      }
      setShowDialog(false);
      toast.success(editId ? "Rule updated" : "Rule created");
      fetchRules();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/rules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    toast.success(isActive ? "Rule disabled" : "Rule enabled");
    fetchRules();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/rules/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`Deleted rule "${deleteTarget.name}"`);
      setDeleteTarget(null);
      fetchRules();
    } catch {
      toast.error("Failed to delete rule");
    } finally {
      setDeleting(false);
    }
  }

  async function handleApplyAll() {
    setApplying(true);
    try {
      const res = await fetch("/api/rules/apply", { method: "POST" });
      const data = await res.json();
      toast.success(`Applied rules to ${data.updated} transactions`);
    } catch {
      toast.error("Failed to apply rules");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorization Rules</h1>
          <p className="text-sm text-gray-500">Manage transaction categorization rules</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleApplyAll} disabled={applying}>
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Apply All Rules
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Rule
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rules ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : rules.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No rules yet. Seed default rules or create new ones.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant={rule.direction === "Money In" ? "success" : "destructive"}>
                        {rule.direction}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {rule.matchField} {rule.condition} &ldquo;{rule.matchValue}&rdquo;
                    </TableCell>
                    <TableCell className="text-sm">{rule.account.accountName}</TableCell>
                    <TableCell>{Math.round(rule.confidence * 100)}%</TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? "success" : "secondary"}>
                        {rule.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggle(rule.id, rule.isActive)}>
                          {rule.isActive ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(rule)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Rule" : "New Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Shell Fuel" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Money In">Money In</SelectItem>
                    <SelectItem value="Money Out">Money Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Match Field</Label>
                <Select value={form.matchField} onValueChange={(v) => setForm({ ...form, matchField: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="description">Description</SelectItem>
                    <SelectItem value="checkNumber">Check Number</SelectItem>
                    <SelectItem value="vendorPayee">Vendor/Payee</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="section">Section</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="startsWith">Starts With</SelectItem>
                    <SelectItem value="endsWith">Ends With</SelectItem>
                    <SelectItem value="equals">Equals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Match Value</Label>
                <Input value={form.matchValue} onChange={(e) => setForm({ ...form, matchValue: e.target.value })} placeholder="e.g. SHELL SERVICE" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>QuickBooks Account</Label>
              <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
                <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor/Payee</Label>
                <Input value={form.vendorPayee} onChange={(e) => setForm({ ...form, vendorPayee: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 100 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the rule <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>?
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
