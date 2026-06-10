import fs from 'fs';
const content = `"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload, Download, Plus, Edit, Search, Loader2, Trash2, BookOpen,
} from "lucide-react";
import { toast } from "sonner";

interface Account {
  id: string;
  accountName: string;
  accountType: string;
  detailType: string | null;
  parentAccount: string | null;
  isActive: boolean;
}

const EMPTY = { accountName: "", accountType: "", detailType: "", parentAccount: "" };

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAccounts(); }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/chart-of-accounts");
      setAccounts(await res.json());
    } catch { toast.error("Failed to load accounts"); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editId ? "/api/chart-of-accounts/" + editId : "/api/chart-of-accounts";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: form.accountName,
          accountType: form.accountType,
          detailType: form.detailType || null,
          parentAccount: form.parentAccount || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Save failed"); }
      setShowDialog(false);
      setForm(EMPTY);
      setEditId(null);
      toast.success(editId ? "Account updated" : "Account created");
      fetchAccounts();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/chart-of-accounts/" + deleteTarget.id, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Deleted " + deleteTarget.accountName);
      setDeleteTarget(null);
      fetchAccounts();
    } catch { toast.error("Delete failed"); }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      await fetch("/api/chart-of-accounts/" + id, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !active }),
      });
      toast.success(active ? "Account disabled" : "Account enabled");
      fetchAccounts();
    } catch { toast.error("Toggle failed"); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/chart-of-accounts/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast.success("Imported " + data.count + " accounts");
      fetchAccounts();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Import failed"); }
    finally { setUploading(false); }
  }

  function openCreate() { setEditId(null); setForm(EMPTY); setShowDialog(true); }
  function openEdit(a: Account) {
    setEditId(a.id);
    setForm({
      accountName: a.accountName, accountType: a.accountType,
      detailType: a.detailType || "", parentAccount: a.parentAccount || "",
    });
    setShowDialog(true);
  }

  function exportCsv() {
    const a = document.createElement("a");
    a.href = "/api/chart-of-accounts/export";
    a.download = "chart-of-accounts.csv";
    a.click();
  }

  const filtered = accounts.filter(a =>
    a.accountName.toLowerCase().includes(search.toLowerCase()) ||
    a.accountType.toLowerCase().includes(search.toLowerCase()) ||
    (a.detailType || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-sm text-gray-500">Manage QuickBooks Chart of Accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4"/> Export CSV</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4"/> Add Account</Button>
          <label htmlFor="coa-upload">
            <Button asChild disabled={uploading} variant="outline">
              <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4"/>} Import CSV</span>
            </Button>
          </label>
          <input id="coa-upload" type="file" accept=".csv" className="hidden" onChange={handleUpload}/>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4"/> Accounts ({filtered.length})</CardTitle>
              <CardDescription>All categorization rules must validate against these accounts</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"/>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          : filtered.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">{accounts.length === 0 ? "No accounts. Import or add manually." : "No matches."}</div>
          : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Detail Type</TableHead><TableHead>Parent</TableHead><TableHead>Status</TableHead><TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.accountName}</TableCell>
                    <TableCell>{a.accountType}</TableCell>
                    <TableCell className="text-gray-500">{a.detailType || "\u2014"}</TableCell>
                    <TableCell className="text-gray-500">{a.parentAccount || "\u2014"}</TableCell>
                    <TableCell><Badge variant={a.isActive ? "success" : "secondary"}>{a.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Edit className="h-3.5 w-3.5"/></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggle(a.id, a.isActive)}>{a.isActive ? "Disable" : "Enable"}</Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(a)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5"/></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Account Name</Label><Input value={form.accountName} onChange={e => setForm({...form, accountName: e.target.value})} placeholder="e.g. Payroll expenses:Wages"/></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Account Type</Label><Input value={form.accountType} onChange={e => setForm({...form, accountType: e.target.value})} placeholder="e.g. Expenses"/></div>
              <div className="space-y-2"><Label>Detail Type</Label><Input value={form.detailType} onChange={e => setForm({...form, detailType: e.target.value})} placeholder="e.g. Payroll Expenses"/></div>
            </div>
            <div className="space-y-2"><Label>Parent Account (optional)</Label><Input value={form.parentAccount} onChange={e => setForm({...form, parentAccount: e.target.value})} placeholder="e.g. Payroll expenses"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.accountName || !form.accountType}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Account</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Are you sure you want to delete <strong>&ldquo;{deleteTarget?.accountName}&rdquo;</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
`;
fs.writeFileSync('src/app/(dashboard)/chart-of-accounts/page.tsx', content);
console.log('done');
