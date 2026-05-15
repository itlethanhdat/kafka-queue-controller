"use client";

import { useState, useEffect } from "react";
import type { Connection, AuthType } from "@/lib/db";
import { addConnection, updateConnection } from "@/lib/db/connections";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const AUTH_TYPES: AuthType[] = ["NONE", "PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512", "SSL"];

const DEFAULT_FORM: Omit<Connection, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  brokers: "",
  authType: "NONE",
  username: "",
  password: "",
  sslCa: "",
  sslCert: "",
  sslKey: "",
  sslRejectUnauthorized: true,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Connection;
}

export default function ConnectionForm({ open, onOpenChange, initial }: Props) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (open) {
      setTestResult(null);
      if (initial) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _, createdAt: _ca, updatedAt: _ua, ...rest } = initial;
        setForm({ ...DEFAULT_FORM, ...rest });
      } else {
        setForm(DEFAULT_FORM);
      }
    }
  }, [open, initial]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const needsCredentials =
    form.authType === "PLAIN" ||
    form.authType === "SCRAM-SHA-256" ||
    form.authType === "SCRAM-SHA-512";

  const needsSsl = form.authType === "SSL";

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.brokers.trim()) return toast.error("Brokers are required");

    setSaving(true);
    try {
      if (initial?.id) {
        await updateConnection(initial.id, form);
        toast.success("Connection updated");
      } else {
        await addConnection(form);
        toast.success("Connection created");
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form.brokers.trim()) return toast.error("Brokers are required");
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/kafka/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: initial?.id ?? 0, createdAt: 0, updatedAt: 0 }),
      });
      const data = await res.json();
      setTestResult({ ok: data.ok, message: data.ok ? data.message : data.error });
    } catch (e: unknown) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Network error" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Connection" : "New Connection"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Name */}
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input
              placeholder="My Kafka cluster"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {/* Brokers */}
          <div className="grid gap-1.5">
            <Label>Brokers</Label>
            <Input
              placeholder="broker1:9092, broker2:9092"
              value={form.brokers}
              onChange={(e) => set("brokers", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma-separated host:port pairs</p>
          </div>

          {/* Auth type */}
          <div className="grid gap-1.5">
            <Label>Authentication</Label>
            <Select value={form.authType} onValueChange={(v) => set("authType", v as AuthType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTH_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SASL credentials */}
          {needsCredentials && (
            <>
              <Separator />
              <div className="grid gap-1.5">
                <Label>Username</Label>
                <Input
                  value={form.username ?? ""}
                  onChange={(e) => set("username", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password ?? ""}
                  onChange={(e) => set("password", e.target.value)}
                />
              </div>
            </>
          )}

          {/* SSL fields */}
          {needsSsl && (
            <>
              <Separator />
              <div className="grid gap-1.5">
                <Label>CA Certificate (PEM)</Label>
                <Textarea
                  rows={3}
                  placeholder="-----BEGIN CERTIFICATE-----"
                  value={form.sslCa ?? ""}
                  onChange={(e) => set("sslCa", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Client Certificate (PEM)</Label>
                <Textarea
                  rows={3}
                  placeholder="-----BEGIN CERTIFICATE-----"
                  value={form.sslCert ?? ""}
                  onChange={(e) => set("sslCert", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Client Key (PEM)</Label>
                <Textarea
                  rows={3}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                  value={form.sslKey ?? ""}
                  onChange={(e) => set("sslKey", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="reject-unauthorized"
                  checked={form.sslRejectUnauthorized ?? true}
                  onCheckedChange={(v) => set("sslRejectUnauthorized", v)}
                />
                <Label htmlFor="reject-unauthorized">Reject unauthorized certificates</Label>
              </div>
            </>
          )}

          {/* Test result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 text-sm p-2 rounded-md border ${
                testResult.ok
                  ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300"
                  : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initial ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
