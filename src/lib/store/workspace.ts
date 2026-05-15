import { create } from "zustand";
import type { WorkspaceTab } from "@/lib/db";

interface WorkspaceState {
  activeTabId: number | null;
  tabs: WorkspaceTab[];
  setActiveTabId: (id: number | null) => void;
  setTabs: (tabs: WorkspaceTab[]) => void;
  addTab: (tab: WorkspaceTab) => void;
  updateTab: (id: number, patch: Partial<WorkspaceTab>) => void;
  removeTab: (id: number) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeTabId: null,
  tabs: [],

  setActiveTabId: (id) => set({ activeTabId: id }),

  setTabs: (tabs) => set({ tabs }),

  addTab: (tab) =>
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id ?? s.activeTabId,
    })),

  updateTab: (id, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  removeTab: (id) =>
    set((s) => {
      const remaining = s.tabs.filter((t) => t.id !== id);
      const newActive =
        s.activeTabId === id
          ? remaining.length > 0
            ? remaining[remaining.length - 1].id ?? null
            : null
          : s.activeTabId;
      return { tabs: remaining, activeTabId: newActive };
    }),
}));
