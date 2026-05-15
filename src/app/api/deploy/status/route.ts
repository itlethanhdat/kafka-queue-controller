import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/deploy/status — Returns deployment configuration and status for dev environment
 * Only accessible in development environment
 */
export async function GET(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 });
  }

  const repoUrl = process.env.VERCEL_REPO_URL || "https://github.com/itlethanhdat/kafka-queue-controller";
  const deployUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(repoUrl)}&project-name=kafka-queue-controller&repo-name=kafka-queue-controller`;

  return NextResponse.json({
    isDev: true,
    deployUrl,
    repoUrl,
    projectName: "Kafka Queue Controller",
    settings: {
      framework: "nextjs",
      buildCommand: "npm run build",
      devCommand: "npm run dev",
      installCommand: "npm install",
    },
  });
}
