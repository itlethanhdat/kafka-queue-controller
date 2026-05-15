"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/lib/store/workspace";
import ConnectionSidebar from "@/components/connections/ConnectionSidebar";
import WorkspaceTabs from "@/components/workspace/WorkspaceTabs";
import EmptyWorkspace from "@/components/workspace/EmptyWorkspace";

export default function WorkspaceShell() {
  const { tabs, activeTabId, setTabs, setActiveTabId } = useWorkspaceStore();
  const dbTabs = useLiveQuery(() => db.tabs.orderBy("order").toArray(), []);

  // Sync IndexedDB tabs → Zustand on mount
  useEffect(() => {
    if (dbTabs) {
      setTabs(dbTabs);
      if (!activeTabId && dbTabs.length > 0) {
        setActiveTabId(dbTabs[dbTabs.length - 1].id ?? null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbTabs]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Left sidebar: connections */}
      <ConnectionSidebar />

      {/* Main workspace */}
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {tabs.length === 0 ? (
          <EmptyWorkspace />
        ) : (
          <WorkspaceTabs />
        )}
      </main>
    </div>
  );
}
