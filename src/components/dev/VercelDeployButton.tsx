"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Cloud, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeploymentConfig {
  isDev: boolean;
  deployUrl: string;
  repoUrl: string;
  projectName: string;
  settings: {
    framework: string;
    buildCommand: string;
    devCommand: string;
    installCommand: string;
  };
}

export default function VercelDeployButton() {
  const [isDev, setIsDev] = useState(false);
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<DeploymentConfig | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if we're in development environment
  useEffect(() => {
    const isDevelopment = process.env.NODE_ENV === "development";
    setIsDev(isDevelopment);

    if (isDevelopment) {
      // Fetch deployment configuration
      fetch("/api/deploy/status")
        .then((res) => res.json())
        .then((data) => setConfig(data))
        .catch((err) => console.error("Failed to fetch deployment config:", err));
    }
  }, []);

  if (!isDev || !config) return null;

  const handleDeploy = async () => {
    setLoading(true);
    try {
      // Open Vercel deploy URL in new tab
      window.open(config.deployUrl, "_blank", "noopener,noreferrer");
      toast.success("Opening Vercel deployment page...");
      setOpen(false);
    } catch (error) {
      toast.error("Failed to open deployment page");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Deploy button - typically added to header or toolbar */}
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
      >
        <Cloud className="w-4 h-4" />
        Deploy to Vercel
      </Button>

      {/* Deploy dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-600" />
              Deploy to Vercel
            </DialogTitle>
            <DialogDescription>
              One-click deployment of {config.projectName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Project Info */}
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium mb-1">Project</p>
              <p className="text-xs text-muted-foreground">{config.projectName}</p>
            </div>

            {/* Build Settings */}
            <div className="rounded-lg bg-muted p-3 space-y-2">
              <p className="text-sm font-medium">Build Settings</p>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div>
                  <span className="font-semibold">Framework:</span> {config.settings.framework}
                </div>
                <div>
                  <span className="font-semibold">Build:</span> {config.settings.buildCommand}
                </div>
                <div>
                  <span className="font-semibold">Install:</span>{" "}
                  {config.settings.installCommand}
                </div>
              </div>
            </div>

            {/* Repository Info */}
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium mb-1">Repository</p>
              <p className="text-xs text-muted-foreground break-all">{config.repoUrl}</p>
            </div>

            {/* Info Box */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3">
              <p className="text-xs text-blue-900 dark:text-blue-100">
                You will be redirected to Vercel to complete the deployment setup. Make sure you
                have a Vercel account.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Deploy Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
