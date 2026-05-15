import { NextRequest, NextResponse } from "next/server";
import { buildKafkaClient } from "@/lib/kafka/client";
import type { Connection } from "@/lib/db";

interface TestProducerRequest {
  connection: Connection;
  topic: string;
}

export async function POST(req: NextRequest) {
  let body: TestProducerRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { connection, topic } = body;
  if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

  const kafka = buildKafkaClient(connection);
  const producer = kafka.producer();
  try {
    await producer.connect();
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify({ _test: true, ts: Date.now() }) }],
    });
    return NextResponse.json({ ok: true, message: "Test message sent successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  } finally {
    await producer.disconnect().catch(() => {});
  }
}
