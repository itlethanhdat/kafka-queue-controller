"use client";

import { PlusCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmptyWorkspace() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <Zap className="w-16 h-16 opacity-20" />
      <h2 className="text-xl font-semibold text-foreground">No tabs open</h2>
      <p className="text-sm">Select a connection on the left and open a Produce or Consume tab.</p>
      <Button variant="outline" size="sm" disabled>
        <PlusCircle className="w-4 h-4 mr-2" />
        Open a tab from the sidebar
      </Button>
    </div>
  );
}
