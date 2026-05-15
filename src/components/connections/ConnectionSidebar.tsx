"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Connection } from "@/lib/db";
import { useWorkspaceStore } from "@/lib/store/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  Upload,
  Database,
  SendHorizonal,
  MessageSquare,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import ConnectionForm from "./ConnectionForm";
import TemplatesManager from "@/components/templates/TemplatesManager";
import { exportDB, importDB } from "@/lib/db";
import { cn } from "@/lib/utils";

export default function ConnectionSidebar() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editConn, setEditConn] = useState<Connection | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const connections = useLiveQuery(
    () => db.connections.orderBy("name").toArray(),
    []
  );

  const filtered = (connections ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const { addTab, setActiveTabId } = useWorkspaceStore();

  const openTab = async (conn: Connection, type: "produce" | "consume") => {
    const title = `${type === "produce" ? "✏️" : "📥"} ${conn.name}`;
    const order = Date.now();
    const id = await db.tabs.add({
      connectionId: conn.id!,
      type,
      title,
      config: JSON.stringify({ topic: "" }),
      order,
      createdAt: Date.now(),
    });
    const newTab = await db.tabs.get(id);
    if (newTab) {
      addTab(newTab);
      setActiveTabId(newTab.id ?? null);
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    await db.connections.delete(deleteId);
    setDeleteId(null);
    toast.success("Connection deleted");
  };

  const handleExportAll = async () => {
    const json = await exportDB();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kafka-controller-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Database exported");
  };

  const handleImportAll = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        await importDB(text);
        toast.success("Database imported successfully");
      } catch {
        toast.error("Failed to import: invalid file");
      }
    };
    input.click();
  };

  const handleExportConn = (conn: Connection) => {
    const json = JSON.stringify(conn, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conn-${conn.name.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${conn.name}`);
  };

  return (
    <aside className="flex flex-col w-64 shrink-0 border-r border-border bg-muted/20 h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        <span className="font-semibold text-sm flex items-center gap-1.5">
          <Database className="w-4 h-4" />
          Connections
        </span>
        <div className="flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => {
                  setEditConn(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
              </TooltipTrigger>
              <TooltipContent>New connection</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={handleExportAll}
              >
                <Download className="w-3.5 h-3.5" />
              </TooltipTrigger>
              <TooltipContent>Export all data</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={handleImportAll}
              >
                <Upload className="w-3.5 h-3.5" />
              </TooltipTrigger>
              <TooltipContent>Import data</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search connections…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Connection list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">
            {search ? "No results" : "No connections yet"}
          </p>
        )}
        {filtered.map((conn) => (
          <div key={conn.id} className="group px-2 py-1">
            <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{conn.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {conn.brokers.split(",")[0]}
                </p>
              </div>

              <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent transition-colors"
                      onClick={() => openTab(conn, "produce")}
                    >
                      <SendHorizonal className="w-3 h-3 text-orange-500" />
                    </TooltipTrigger>
                    <TooltipContent>New Produce tab</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent transition-colors"
                      onClick={() => openTab(conn, "consume")}
                    >
                      <MessageSquare className="w-3 h-3 text-green-500" />
                    </TooltipTrigger>
                    <TooltipContent>New Consume tab</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent transition-colors">
                    <MoreVertical className="w-3 h-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditConn(conn);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportConn(conn)}>
                      <Download className="w-3.5 h-3.5 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(conn.id!)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] ml-1 shrink-0",
                  conn.authType === "NONE" && "opacity-40"
                )}
              >
                {conn.authType}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar footer */}
      <div className="shrink-0 p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => setTemplatesOpen(true)}
        >
          <FileText className="w-4 h-4 mr-2" />
          Templates
        </Button>
      </div>

      {/* Connection form dialog */}
      <ConnectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editConn}
      />

      {/* Templates manager */}
      <TemplatesManager open={templatesOpen} onOpenChange={setTemplatesOpen} />

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the connection. Open tabs using this connection will
              remain open but unable to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
