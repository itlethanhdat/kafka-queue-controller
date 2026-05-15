"use client";

import { useEffect, useState } from "react";
import VercelDeployButton from "@/components/dev/VercelDeployButton";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Dev toolbar visible only in development environment */
export default function DevToolbar() {
  const [isDev, setIsDev] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsDev(process.env.NODE_ENV === "development");
  }, []);

  if (!isDev || !isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20 shadow-lg p-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-yellow-700 dark:text-yellow-200 font-medium">
            Development Mode
          </div>
          <Separator orientation="vertical" className="h-4" />
          <VercelDeployButton />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
