import { NextRequest, NextResponse } from "next/server";
import { buildKafkaClient } from "@/lib/kafka/client";
import type { Connection } from "@/lib/db";

interface SendRequest {
  connection: Connection;
  topic: string;
  messages: Array<{
    key?: string;
    value: string;
    headers?: Record<string, string>;
  }>;
}

export async function POST(req: NextRequest) {
  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { connection, topic, messages } = body;
  if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });
  if (!messages?.length) return NextResponse.json({ error: "messages is required" }, { status: 400 });

  const kafka = buildKafkaClient(connection);
  const producer = kafka.producer();
  try {
    await producer.connect();
    const result = await producer.send({
      topic,
      messages: messages.map((m) => ({
        key: m.key,
        value: m.value,
        headers: m.headers,
      })),
    });
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  } finally {
    await producer.disconnect().catch(() => {});
  }
}
