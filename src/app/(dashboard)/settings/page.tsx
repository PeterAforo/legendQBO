"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Lock, Link2, Unlink, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface CompanySettings {
  id: string;
  companyName: string;
  qboCompanyName: string;
  bankName: string;
  currency: string;
  notes: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // QBO connection
  const [qboStatus, setQboStatus] = useState<{
    connected: boolean;
    realmId?: string;
    companyName?: string;
    tokenValid?: boolean;
    expiresAt?: string;
  } | null>(null);
  const [qboLoading, setQboLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchQboStatus();

    // Check for QBO callback params
    const params = new URLSearchParams(window.location.search);
    if (params.get("qbo") === "connected") {
      toast.success("Connected to QuickBooks Online!");
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("qbo") === "error") {
      toast.error(`QBO connection failed: ${params.get("msg") || "unknown error"}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  async function fetchQboStatus() {
    setQboLoading(true);
    try {
      const res = await fetch("/api/qbo/status");
      setQboStatus(await res.json());
    } catch {
      setQboStatus({ connected: false });
    } finally {
      setQboLoading(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/qbo/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Disconnect failed");
      toast.success("Disconnected from QuickBooks");
      setQboStatus({ connected: false });
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSyncAccounts() {
    setSyncing(true);
    try {
      const res = await fetch("/api/qbo/sync-accounts", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(`Synced ${data.count} accounts from QuickBooks`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password change failed");
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Legends Homecare company configuration</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Company Settings</CardTitle>
            <CardDescription>Single-company setup for Legends Homecare LLC</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={settings?.companyName || ""}
                  onChange={(e) => setSettings((s) => s ? { ...s, companyName: e.target.value } : s)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qboCompanyName">QuickBooks Company Name</Label>
                <Input
                  id="qboCompanyName"
                  value={settings?.qboCompanyName || ""}
                  onChange={(e) => setSettings((s) => s ? { ...s, qboCompanyName: e.target.value } : s)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={settings?.bankName || ""}
                    onChange={(e) => setSettings((s) => s ? { ...s, bankName: e.target.value } : s)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={settings?.currency || ""}
                    onChange={(e) => setSettings((s) => s ? { ...s, currency: e.target.value } : s)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={settings?.notes || ""}
                  onChange={(e) => setSettings((s) => s ? { ...s, notes: e.target.value } : s)}
                  placeholder="Optional notes"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your admin login password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              QuickBooks Online Integration
            </CardTitle>
            <CardDescription>Connect to push transactions directly to QuickBooks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qboLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-gray-500">Checking connection...</span>
              </div>
            ) : qboStatus?.connected ? (
              <>
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">Connected</p>
                    <p className="text-xs text-green-600">
                      {qboStatus.companyName || qboStatus.realmId}
                    </p>
                  </div>
                  <Badge variant={qboStatus.tokenValid ? "success" : "destructive"}>
                    {qboStatus.tokenValid ? "Token Valid" : "Token Expired"}
                  </Badge>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleSyncAccounts} disabled={syncing}>
                    {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Sync Accounts from QBO
                  </Button>
                  <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <XCircle className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Not Connected</p>
                    <p className="text-xs text-gray-500">
                      Connect to push categorized transactions directly to QBO
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <a href="/api/qbo/connect">
                    <Link2 className="h-4 w-4" />
                    Connect to QuickBooks
                  </a>
                </Button>
                <p className="text-xs text-gray-400">
                  Requires QBO_CLIENT_ID and QBO_CLIENT_SECRET environment variables.
                  Register at developer.intuit.com.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
