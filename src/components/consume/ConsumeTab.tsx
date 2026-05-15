"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { db, addMessage } from "@/lib/db";
import type { Connection, KafkaMessage } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Play,
  Square,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import TopicPicker from "@/components/shared/TopicPicker";
import { validateAgainstSchema } from "@/lib/templates/json-schema";
import { validateAgainstMustache } from "@/lib/templates/mustache";
import { useLiveQuery } from "dexie-react-hooks";


interface TabConfig {
  topic: string;
  groupId: string;
  fromBeginning: boolean;
  autoRefreshMs: string;
  validateTemplateId?: number;
}

const DEFAULT_CONFIG: TabConfig = {
  topic: "",
  groupId: "",
  fromBeginning: false,
  autoRefreshMs: "0",
};

interface Props {
  tabId: number;
  connectionId: number | null;
}

export default function ConsumeTab({ tabId, connectionId }: Props) {
  const [config, setConfig] = useState<TabConfig>(DEFAULT_CONFIG);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [consuming, setConsuming] = useState(false);
  const [testing, setTesting] = useState(false);
  const [messages, setMessages] = useState<KafkaMessage[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sseRef = useRef<EventSource | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const templates = useLiveQuery(() => db.templates.toArray(), []);

  // Load tab config + persisted messages
  useEffect(() => {
    db.tabs.get(tabId).then((tab) => {
      if (tab?.config) {
        try {
          setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(tab.config) });
        } catch {}
      }
    });
    db.messages.where("tabId").equals(tabId).sortBy("receivedAt").then(setMessages);
  }, [tabId]);

  // Load connection
  useEffect(() => {
    if (connectionId) db.connections.get(connectionId).then((c) => setConnection(c ?? null));
  }, [connectionId]);

  const persistConfig = async (patch: Partial<TabConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    await db.tabs.update(tabId, { config: JSON.stringify(next) });
  };

  const stopConsuming = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (autoRefreshRef.current) {
      clearTimeout(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    setConsuming(false);
  }, []);

  const startConsuming = useCallback(async () => {
    if (!connection) return toast.error("No connection available");
    if (!config.topic) return toast.error("Topic is required");
    stopConsuming();

    const groupId = config.groupId || `kafka-controller-${tabId}-${Date.now()}`;
    const params = new URLSearchParams({
      connection: JSON.stringify(connection),
      topic: config.topic,
      groupId,
      fromBeginning: String(config.fromBeginning),
    });

    const es = new EventSource(`/api/kafka/consume?${params.toString()}`);
    sseRef.current = es;
    setConsuming(true);

    es.addEventListener("connected", () => {
      toast.success(`Consuming from ${config.topic}`);
    });

    es.addEventListener("message", async (e) => {
      try {
        const raw = JSON.parse(e.data) as Omit<KafkaMessage, "id" | "tabId">;
        const msg: Omit<KafkaMessage, "id"> = { ...raw, tabId };
        await addMessage(msg);
        setMessages((prev) => {
          const updated = [...prev, { ...msg }];
          if (updated.length > 5000) return updated.slice(-5000);
          return updated;
        });
      } catch {}
    });

    es.addEventListener("error", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        toast.error(`Consumer error: ${data.error}`);
      } catch {}
      stopConsuming();
    });

    es.onerror = () => {
      if (sseRef.current?.readyState === EventSource.CLOSED) {
        stopConsuming();
      }
    };

    // Auto-refresh (restart consumer after N ms)
    const refreshMs = parseInt(config.autoRefreshMs) || 0;
    if (refreshMs > 0) {
      autoRefreshRef.current = setTimeout(() => {
        startConsuming();
      }, refreshMs);
    }
  }, [connection, config, tabId, stopConsuming]);

  useEffect(() => {
    return () => stopConsuming();
  }, [stopConsuming]);

  const handleClear = async () => {
    await db.messages.where("tabId").equals(tabId).delete();
    setMessages([]);
  };

  const handleTestConsumer = async () => {
    if (!connection) return toast.error("No connection available");
    if (!config.topic) return toast.error("Topic is required");
    setTesting(true);
    try {
      const res = await fetch("/api/kafka/test-consumer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection,
          topic: config.topic,
          groupId: config.groupId || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) toast.success(data.message);
      else toast.error(data.error);
    } finally {
      setTesting(false);
    }
  };

  const getValidation = (msg: KafkaMessage) => {
    if (!config.validateTemplateId || !msg.value) return null;
    const tpl = templates?.find((t) => t.id === config.validateTemplateId);
    if (!tpl) return null;
    try {
      if (tpl.type === "json-schema") {
        return validateAgainstSchema(tpl.content, msg.value);
      } else {
        return validateAgainstMustache(tpl.content, msg.value);
      }
    } catch {
      return null;
    }
  };

  // Virtual list
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Config bar */}
      <div className="flex flex-wrap gap-3 items-end px-4 pt-4 pb-3 border-b border-border shrink-0">
        {/* Topic */}
        <div className="grid gap-1.5 flex-1 min-w-[200px]">
          <Label>Topic</Label>
          <TopicPicker
            connectionId={connectionId}
            value={config.topic}
            onChange={(v) => persistConfig({ topic: v })}
            placeholder="Select topic"
          />
        </div>

        {/* Group ID */}
        <div className="grid gap-1.5 w-44">
          <Label>Group ID (optional)</Label>
          <Input
            placeholder="auto"
            value={config.groupId}
            onChange={(e) => persistConfig({ groupId: e.target.value })}
          />
        </div>

        {/* From beginning */}
        <div className="flex items-center gap-2 pt-5">
          <Switch
            id={`from-begin-${tabId}`}
            checked={config.fromBeginning}
            onCheckedChange={(v) => persistConfig({ fromBeginning: v })}
          />
          <Label htmlFor={`from-begin-${tabId}`}>From beginning</Label>
        </div>

        {/* Auto-refresh */}
        <div className="grid gap-1.5 w-36">
          <Label>Auto-refresh (ms, 0=off)</Label>
          <Input
            type="number"
            min={0}
            step={1000}
            placeholder="0"
            value={config.autoRefreshMs}
            onChange={(e) => persistConfig({ autoRefreshMs: e.target.value })}
          />
        </div>

        {/* Validate template */}
        <div className="grid gap-1.5 w-48">
          <Label>Validate against template</Label>
          <Select
            value={config.validateTemplateId?.toString() ?? "none"}
            onValueChange={(v) =>
              persistConfig({ validateTemplateId: v === "none" ? undefined : parseInt(v ?? "0") })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(templates ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0 bg-muted/20">
        <Button size="sm" onClick={consuming ? stopConsuming : startConsuming} disabled={!connection}>
          {consuming ? (
            <>
              <Square className="w-4 h-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={handleTestConsumer} disabled={testing || !connection}>
          {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Test Consumer
        </Button>
        <Button size="sm" variant="ghost" onClick={handleClear} disabled={messages.length === 0}>
          <Trash2 className="w-4 h-4 mr-2" />
          Clear
        </Button>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {consuming && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Consuming
            </span>
          )}
          <Badge variant="outline">{messages.length} messages</Badge>
          {!connection && (
            <Badge variant="outline" className="text-orange-500 border-orange-300">
              No connection
            </Badge>
          )}
        </div>
      </div>

      {/* Messages virtual list */}
      <div ref={parentRef} className="flex-1 overflow-y-auto font-mono">
        {messages.length === 0 && (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">
            No messages yet. Start consuming to receive messages.
          </p>
        )}

        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const msg = messages[virtualRow.index];
            const validation = getValidation(msg);
            const isExpanded = expandedId === (msg.id ?? virtualRow.index);

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="border-b border-border"
              >
                <button
                  className="w-full text-left px-4 py-2 hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : (msg.id ?? virtualRow.index))}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0">
                      #{virtualRow.index + 1}
                    </span>
                    <span className="text-blue-500 shrink-0">p{msg.partition}</span>
                    <span className="text-muted-foreground shrink-0">@{msg.offset}</span>
                    {msg.key && (
                      <span className="text-yellow-600 dark:text-yellow-400 shrink-0 max-w-[80px] truncate">
                        key:{msg.key}
                      </span>
                    )}
                    <span className="flex-1 truncate text-foreground">{msg.value}</span>
                    {validation && (
                      validation.valid ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 text-xs space-y-2 bg-muted/20">
                    <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-0.5">
                      <span className="text-muted-foreground">Timestamp</span>
                      <span>{new Date(msg.timestamp).toISOString()}</span>
                      <span className="text-muted-foreground">Topic</span>
                      <span>{msg.topic}</span>
                      <span className="text-muted-foreground">Partition</span>
                      <span>{msg.partition}</span>
                      <span className="text-muted-foreground">Offset</span>
                      <span>{msg.offset}</span>
                      {msg.key && (
                        <>
                          <span className="text-muted-foreground">Key</span>
                          <span>{msg.key}</span>
                        </>
                      )}
                    </div>
                    {msg.headers && msg.headers !== "{}" && (
                      <div>
                        <p className="text-muted-foreground mb-1">Headers</p>
                        <pre className="bg-background border rounded p-2 overflow-auto text-xs">
                          {JSON.stringify(JSON.parse(msg.headers), null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground mb-1">Value</p>
                      <pre className="bg-background border rounded p-2 overflow-auto text-xs max-h-40">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(msg.value ?? ""), null, 2);
                          } catch {
                            return msg.value ?? "(null)";
                          }
                        })()}
                      </pre>
                    </div>
                    {validation && !validation.valid && (
                      <div className="flex items-start gap-1.5 text-red-600 dark:text-red-400">
                        <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{"errors" in validation ? (validation.errors ?? []).join("; ") : ("message" in validation ? validation.message : "Validation failed")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
