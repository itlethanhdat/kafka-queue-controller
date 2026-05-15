"use client";

import { X } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/workspace";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import ProduceTab from "@/components/produce/ProduceTab";
import ConsumeTab from "@/components/consume/ConsumeTab";

export default function WorkspaceTabs() {
  const { tabs, activeTabId, setActiveTabId, removeTab } = useWorkspaceStore();

  const handleClose = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    removeTab(id);
    await db.tabs.delete(id);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-end gap-0 border-b border-border overflow-x-auto shrink-0 bg-muted/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id ?? null)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm border-b-2 border-transparent whitespace-nowrap transition-colors hover:bg-muted/60",
              activeTabId === tab.id
                ? "border-primary bg-background text-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full shrink-0",
                tab.type === "produce" ? "bg-orange-400" : "bg-green-500"
              )}
            />
            <span className="max-w-[160px] truncate">{tab.title}</span>
            <span
              role="button"
              onClick={(e) => handleClose(e, tab.id!)}
              className="ml-1 opacity-40 hover:opacity-100 rounded hover:bg-muted transition-opacity"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab?.type === "produce" && activeTab.id != null && (
          <ProduceTab tabId={activeTab.id} connectionId={activeTab.connectionId} />
        )}
        {activeTab?.type === "consume" && activeTab.id != null && (
          <ConsumeTab tabId={activeTab.id} connectionId={activeTab.connectionId} />
        )}
      </div>
    </div>
  );
}
