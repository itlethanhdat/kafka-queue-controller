import { NextRequest, NextResponse } from "next/server";
import { buildKafkaClient } from "@/lib/kafka/client";
import type { Connection } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const connParam = searchParams.get("connection");

  if (!connParam) {
    return NextResponse.json({ error: "connection query param required" }, { status: 400 });
  }

  let connection: Connection;
  try {
    connection = JSON.parse(connParam);
  } catch {
    return NextResponse.json({ error: "Invalid connection JSON" }, { status: 400 });
  }

  const kafka = buildKafkaClient(connection);
  const admin = kafka.admin();
  try {
    await admin.connect();
    const topics = await admin.listTopics();
    topics.sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ topics });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await admin.disconnect().catch(() => {});
  }
}
