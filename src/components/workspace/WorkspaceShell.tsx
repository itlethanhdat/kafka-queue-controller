"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/lib/store/workspace";
import ConnectionSidebar from "@/components/connections/ConnectionSidebar";
import WorkspaceTabs from "@/components/workspace/WorkspaceTabs";
import EmptyWorkspace from "@/components/workspace/EmptyWorkspace";

const SIDEBAR_WIDTH_KEY = "kqc_sidebar_width";
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 256;

export default function WorkspaceShell() {
  const { tabs, activeTabId, setTabs, setActiveTabId } = useWorkspaceStore();
  const dbTabs = useLiveQuery(() => db.tabs.orderBy("order").toArray(), []);

  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DEFAULT);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const n = stored ? parseInt(stored, 10) : NaN;
    if (!isNaN(n)) setSidebarWidth(Math.min(Math.max(n, SIDEBAR_MIN), SIDEBAR_MAX));
  }, []);

  const isResizing = useRef(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isResizing.current) return;
    const next = Math.min(Math.max(e.clientX, SIDEBAR_MIN), SIDEBAR_MAX);
    setSidebarWidth(next);
  }, []);

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (!isResizing.current) return;
    isResizing.current = false;
    dragHandleRef.current?.releasePointerCapture(e.pointerId);
    const final = Math.min(Math.max(e.clientX, SIDEBAR_MIN), SIDEBAR_MAX);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(final));
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

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

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const handleDragPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isResizing.current = true;
    dragHandleRef.current?.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Left sidebar: connections */}
      <ConnectionSidebar width={sidebarWidth} />

      {/* Drag-to-resize handle */}
      <div
        ref={dragHandleRef}
        onPointerDown={handleDragPointerDown}
        className="w-1 shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
        title="Drag to resize"
      />

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
