import { NextRequest } from "next/server";
import { buildKafkaClient } from "@/lib/kafka/client";
import type { Connection } from "@/lib/db";

export const dynamic = "force-dynamic";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

interface ConsumeParams {
  connection: Connection;
  topic: string;
  groupId: string;
  fromBeginning: boolean;
}

function buildStream(params: ConsumeParams, signal: AbortSignal): ReadableStream {
  const { connection, topic, groupId, fromBeginning } = params;
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const kafka = buildKafkaClient(connection);
      const consumer = kafka.consumer({ groupId });

      const enqueue = (text: string) => {
        try { controller.enqueue(encoder.encode(text)); } catch { /* client gone */ }
      };

      const sendEvent = (event: string, data: unknown) => {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Heartbeat to keep the connection alive through proxies
      const heartbeatTimer = setInterval(() => {
        enqueue(": heartbeat\n\n");
      }, 15_000);

      const cleanup = async () => {
        clearInterval(heartbeatTimer);
        try { await consumer.disconnect(); } catch { /* ignore */ }
        try { controller.close(); } catch { /* ignore */ }
      };

      signal.addEventListener("abort", () => { cleanup(); });

      // Register before connect so the very first GROUP_JOIN is never missed.
      consumer.on(consumer.events.GROUP_JOIN, () => {
        sendEvent("connected", { groupId, topic });
      });

      // Surface broker-side ACL/auth crashes (kafkajs wraps these as
      // KafkaJSGroupCoordinatorNotFound, which hides the real reason).
      consumer.on(consumer.events.CRASH, (e) => {
        const inner = e.payload?.error;
        const reason = inner instanceof Error ? inner.message : String(inner ?? "unknown crash");
        const hint = /authorization|not authorized|coordinator/i.test(reason)
          ? ` Hint: broker rejected groupId "${groupId}" — try a Group ID you have ACL permission for.`
          : "";
        sendEvent("error", { error: `${reason}.${hint}` });
        cleanup();
      });

      try {
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning });

        await consumer.run({
          eachMessage: async ({ topic: t, partition, message }) => {
            const msg = {
              topic: t,
              partition,
              offset: message.offset,
              key: message.key?.toString() ?? null,
              value: message.value?.toString() ?? null,
              headers: JSON.stringify(
                Object.fromEntries(
                  Object.entries(message.headers ?? {}).map(([k, v]) => [
                    k,
                    Buffer.isBuffer(v) ? v.toString() : String(v ?? ""),
                  ])
                )
              ),
              timestamp: Number(message.timestamp),
              receivedAt: Date.now(),
            };
            sendEvent("message", msg);
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        sendEvent("error", { error: msg });
        await cleanup();
      }
    },
  });
}

/** POST — preferred: connection sent in body, avoids URL length limits with SSL certs. */
export async function POST(req: NextRequest) {
  let body: ConsumeParams;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!body.connection || !body.topic) {
    return new Response("connection and topic are required", { status: 400 });
  }

  // When fromBeginning=true, force a unique groupId so offset tracking never
  // causes the consumer to skip already-committed messages.
  if (body.fromBeginning && !body.groupId) {
    body.groupId = `kqc-${body.topic}-${Date.now()}`;
  }
  body.groupId = body.groupId || `kqc-${Date.now()}`;

  return new Response(buildStream(body, req.signal), { headers: SSE_HEADERS });
}

/** GET — kept for backwards-compatibility and simple curl testing. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const connParam = searchParams.get("connection");
  const topic = searchParams.get("topic") ?? "";
  const fromBeginning = searchParams.get("fromBeginning") === "true";

  if (!connParam || !topic) {
    return new Response("connection and topic are required", { status: 400 });
  }

  let connection: Connection;
  try {
    connection = JSON.parse(connParam);
  } catch {
    return new Response("Invalid connection JSON", { status: 400 });
  }

  let groupId = searchParams.get("groupId") ?? "";
  if (fromBeginning && !groupId) groupId = `kqc-${topic}-${Date.now()}`;
  groupId = groupId || `kqc-${Date.now()}`;

  return new Response(
    buildStream({ connection, topic, groupId, fromBeginning }, req.signal),
    { headers: SSE_HEADERS }
  );
}
