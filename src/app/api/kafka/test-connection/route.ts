import { NextRequest, NextResponse } from "next/server";
import { buildKafkaClient } from "@/lib/kafka/client";
import type { Connection } from "@/lib/db";

export async function POST(req: NextRequest) {
  let conn: Connection;
  try {
    conn = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const kafka = buildKafkaClient(conn);
  const admin = kafka.admin();
  try {
    await admin.connect();
    await admin.listTopics(); // lightweight check
    return NextResponse.json({ ok: true, message: "Connection successful" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  } finally {
    await admin.disconnect().catch(() => {});
  }
}
