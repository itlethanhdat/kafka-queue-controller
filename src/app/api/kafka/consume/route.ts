import { NextRequest } from "next/server";
import { buildKafkaClient } from "@/lib/kafka/client";
import type { Connection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const connParam = searchParams.get("connection");
  const topic = searchParams.get("topic");
  const groupId = searchParams.get("groupId") ?? `kafka-controller-${Date.now()}`;
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const kafka = buildKafkaClient(connection);
      const consumer = kafka.consumer({ groupId });

      const sendEvent = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Client disconnected
        }
      };

      const cleanup = async () => {
        try {
          await consumer.disconnect();
        } catch {
          // Ignore
        }
        try {
          controller.close();
        } catch {
          // Ignore
        }
      };

      // Signal abort from client
      req.signal.addEventListener("abort", () => {
        cleanup();
      });

      try {
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning });

        sendEvent("connected", { groupId, topic });

        await consumer.run({
          eachMessage: async ({ topic: t, partition, message }) => {
            const msg = {
              topic: t,
              partition,
              offset: message.offset,
              key: message.key?.toString() ?? null,
              value: message.value?.toString() ?? null,
              headers: Object.fromEntries(
                Object.entries(message.headers ?? {}).map(([k, v]) => [
                  k,
                  Buffer.isBuffer(v) ? v.toString() : String(v ?? ""),
                ])
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
