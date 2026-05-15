import { NextRequest, NextResponse } from "next/server";
import { buildKafkaClient } from "@/lib/kafka/client";
import type { Connection } from "@/lib/db";

interface TestConsumerRequest {
  connection: Connection;
  topic: string;
  groupId?: string;
}

export async function POST(req: NextRequest) {
  let body: TestConsumerRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { connection, topic, groupId } = body;
  if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

  const kafka = buildKafkaClient(connection);
  const consumer = kafka.consumer({ groupId: groupId ?? `kafka-controller-test-${Date.now()}` });
  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    // Just verify subscription works — no actual message read
    return NextResponse.json({ ok: true, message: "Consumer test successful" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  } finally {
    await consumer.disconnect().catch(() => {});
  }
}
