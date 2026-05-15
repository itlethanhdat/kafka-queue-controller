"use client";

import { useState, useEffect } from "react";
import { getConnection } from "@/lib/db/connections";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  connectionId: number | null;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function TopicPicker({ connectionId, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTopics = async () => {
    if (!connectionId) return;
    const conn = await getConnection(connectionId);
    if (!conn) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/kafka/topics?connection=${encodeURIComponent(JSON.stringify(conn))}`
      );
      const data = await res.json();
      if (data.topics) setTopics(data.topics);
      else toast.error(data.error ?? "Failed to list topics");
    } catch {
      toast.error("Failed to list topics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && topics.length === 0) fetchTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="flex gap-1 w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="flex flex-1 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <span className="truncate">{value || placeholder || "Select topic…"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search topics…" />
            <CommandList>
              {loading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
              ) : topics.length === 0 ? (
                <CommandEmpty>No topics found. Try refreshing.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {topics.map((t) => (
                    <CommandItem
                      key={t}
                      value={t}
                      onSelect={(v) => {
                        onChange(v);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", value === t ? "opacity-100" : "opacity-0")}
                      />
                      {t}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        size="icon"
        variant="outline"
        onClick={fetchTopics}
        disabled={loading || !connectionId}
        className="shrink-0"
        title="Refresh topics"
      >
        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
      </Button>
    </div>
  );
}
