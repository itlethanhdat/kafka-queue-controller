"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { db } from "@/lib/db";
import type { Connection } from "@/lib/db";
import { getConnection } from "@/lib/db/connections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Loader2, Send, Wand2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import TopicPicker from "@/components/shared/TopicPicker";
import { generateFromSchema, validateAgainstSchema } from "@/lib/templates/json-schema";
import { generateFromMustache, validateAgainstMustache } from "@/lib/templates/mustache";
import { useLiveQuery } from "dexie-react-hooks";

// Monaco loaded dynamically (SSR-incompatible)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface TabConfig {
  topic: string;
  key: string;
  valueMode: "raw" | "json-schema" | "mustache";
  templateId?: number;
  repeatCount: string;
  delayMs: string;
}

const DEFAULT_CONFIG: TabConfig = {
  topic: "",
  key: "",
  valueMode: "raw",
  templateId: undefined,
  repeatCount: "1",
  delayMs: "0",
};

interface Props {
  tabId: number;
  connectionId: number | null;
}

export default function ProduceTab({ tabId, connectionId }: Props) {
  const [config, setConfig] = useState<TabConfig>(DEFAULT_CONFIG);
  const [value, setValue] = useState('{\n  "message": "Hello, Kafka!"\n}');
  const [headers, setHeaders] = useState("{}");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [validateResult, setValidateResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);

  const templates = useLiveQuery(() => db.templates.toArray(), []);

  // Load tab config from DB
  useEffect(() => {
    db.tabs.get(tabId).then((tab) => {
      if (tab?.config) {
        try {
          setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(tab.config) });
        } catch {}
      }
    });
  }, [tabId]);

  // Load connection
  useEffect(() => {
    if (connectionId) getConnection(connectionId).then((c) => setConnection(c ?? null));
  }, [connectionId]);

  const persistConfig = async (patch: Partial<TabConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    await db.tabs.update(tabId, { config: JSON.stringify(next) });
  };

  const getEffectiveValue = async (): Promise<string> => {
    if (config.valueMode === "raw") return value;
    const tpl = templates?.find((t) => t.id === config.templateId);
    if (!tpl) return value;
    try {
      if (config.valueMode === "json-schema") {
        const generated = await generateFromSchema(tpl.content);
        return JSON.stringify(generated, null, 2);
      } else {
        const vars = tpl.variables ? JSON.parse(tpl.variables) : {};
        return generateFromMustache(tpl.content, vars);
      }
    } catch {
      toast.error("Template generation failed");
      return value;
    }
  };

  const handleSend = async () => {
    if (!connection) return toast.error("No connection available");
    if (!config.topic) return toast.error("Topic is required");

    let hdrs: Record<string, string> = {};
    try {
      hdrs = JSON.parse(headers);
    } catch {
      return toast.error("Invalid headers JSON");
    }

    const count = Math.max(1, parseInt(config.repeatCount) || 1);
    const delay = Math.max(0, parseInt(config.delayMs) || 0);

    setSending(true);
    try {
      let sentCount = 0;
      for (let i = 0; i < count; i++) {
        const msgValue = await getEffectiveValue();
        const res = await fetch("/api/kafka/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connection,
            topic: config.topic,
            messages: [
              {
                key: config.key || undefined,
                value: msgValue,
                headers: Object.keys(hdrs).length ? hdrs : undefined,
              },
            ],
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          toast.error(`Send failed: ${data.error}`);
          break;
        }
        sentCount++;
        if (delay > 0 && i < count - 1) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      if (sentCount > 0) toast.success(`Sent ${sentCount} message${sentCount > 1 ? "s" : ""}`);
    } finally {
      setSending(false);
    }
  };

  const handleTestProducer = async () => {
    if (!connection) return toast.error("No connection available");
    if (!config.topic) return toast.error("Topic is required");
    setTesting(true);
    try {
      const res = await fetch("/api/kafka/test-producer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection, topic: config.topic }),
      });
      const data = await res.json();
      if (data.ok) toast.success(data.message);
      else toast.error(data.error);
    } finally {
      setTesting(false);
    }
  };

  const handleGenerate = async () => {
    if (config.valueMode === "raw") return;
    const tpl = templates?.find((t) => t.id === config.templateId);
    if (!tpl) return toast.error("Select a template first");
    try {
      if (config.valueMode === "json-schema") {
        const generated = await generateFromSchema(tpl.content);
        setValue(JSON.stringify(generated, null, 2));
      } else {
        const vars = tpl.variables ? JSON.parse(tpl.variables) : {};
        setValue(generateFromMustache(tpl.content, vars));
      }
    } catch {
      toast.error("Template generation failed");
    }
  };

  const handleValidate = () => {
    const tpl = templates?.find((t) => t.id === config.templateId);
    if (!tpl) return toast.error("Select a template first");
    try {
      if (config.valueMode === "json-schema") {
        const r = validateAgainstSchema(tpl.content, value);
        setValidateResult({ ok: r.valid, msg: r.valid ? "Valid!" : (r.errors ?? []).join("; ") });
      } else {
        const r = validateAgainstMustache(tpl.content, value);
        setValidateResult({ ok: r.valid, msg: r.message });
      }
    } catch (e: unknown) {
      setValidateResult({ ok: false, msg: e instanceof Error ? e.message : "Validation error" });
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Topic */}
        <div className="grid gap-1.5 flex-1 min-w-[200px]">
          <Label>Topic</Label>
          <TopicPicker
            connectionId={connectionId}
            value={config.topic}
            onChange={(v) => persistConfig({ topic: v })}
            placeholder="Select or type a topic"
          />
        </div>

        {/* Message key */}
        <div className="grid gap-1.5 w-48">
          <Label>Key (optional)</Label>
          <Input
            placeholder="Message key"
            value={config.key}
            onChange={(e) => persistConfig({ key: e.target.value })}
          />
        </div>

        {/* Repeat / delay */}
        <div className="grid gap-1.5 w-24">
          <Label>Repeat</Label>
          <Input
            type="number"
            min={1}
            max={10000}
            value={config.repeatCount}
            onChange={(e) => persistConfig({ repeatCount: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5 w-28">
          <Label>Delay (ms)</Label>
          <Input
            type="number"
            min={0}
            value={config.delayMs}
            onChange={(e) => persistConfig({ delayMs: e.target.value })}
          />
        </div>
      </div>

      {/* Template controls */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="grid gap-1.5 w-44">
          <Label>Value mode</Label>
          <Select
            value={config.valueMode}
            onValueChange={(v) => persistConfig({ valueMode: v as TabConfig["valueMode"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="raw">Raw</SelectItem>
              <SelectItem value="json-schema">JSON Schema template</SelectItem>
              <SelectItem value="mustache">Mustache template</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {config.valueMode !== "raw" && (
          <div className="grid gap-1.5 w-52">
            <Label>Template</Label>
            <Select
              value={config.templateId?.toString() ?? ""}
              onValueChange={(v) => persistConfig({ templateId: v ? parseInt(v) : undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {(templates ?? [])
                  .filter((t) =>
                    config.valueMode === "json-schema"
                      ? t.type === "json-schema"
                      : t.type === "mustache"
                  )
                  .map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {config.valueMode !== "raw" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors h-9"
                onClick={handleGenerate}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Generate
              </TooltipTrigger>
              <TooltipContent>Generate random value from template</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors h-9"
                onClick={handleValidate}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Validate
              </TooltipTrigger>
              <TooltipContent>Validate current value against template</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {validateResult && (
          <div
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
              validateResult.ok
                ? "text-green-700 border-green-200 bg-green-50 dark:text-green-300 dark:border-green-800 dark:bg-green-950"
                : "text-red-700 border-red-200 bg-red-50 dark:text-red-300 dark:border-red-800 dark:bg-red-950"
            }`}
          >
            {validateResult.ok ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {validateResult.msg}
          </div>
        )}
      </div>

      {/* Editors */}
      <Tabs defaultValue="value" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="value">Value</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
        </TabsList>
        <TabsContent value="value" className="flex-1 min-h-0 mt-2">
          <div className="h-64 border rounded-md overflow-hidden">
            <MonacoEditor
              height="100%"
              language="json"
              value={value}
              onChange={(v) => setValue(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                formatOnPaste: true,
              }}
              theme="vs-dark"
            />
          </div>
        </TabsContent>
        <TabsContent value="headers" className="flex-1 min-h-0 mt-2">
          <div className="h-64 border rounded-md overflow-hidden">
            <MonacoEditor
              height="100%"
              language="json"
              value={headers}
              onChange={(v) => setHeaders(v ?? "{}")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: "on",
                scrollBeyondLastLine: false,
              }}
              theme="vs-dark"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        <Button onClick={handleSend} disabled={sending || !connection}>
          {sending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Send
        </Button>
        <Button variant="outline" onClick={handleTestProducer} disabled={testing || !connection}>
          {testing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Test Producer
        </Button>
        {!connection && (
          <Badge variant="outline" className="ml-auto text-orange-500 border-orange-300">
            No connection
          </Badge>
        )}
      </div>
    </div>
  );
}
