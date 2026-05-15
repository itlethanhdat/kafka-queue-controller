import { Kafka, type KafkaConfig, type SASLOptions } from "kafkajs";
import type { Connection } from "@/lib/db";

/**
 * Build a KafkaJS Kafka instance from a stored Connection record.
 * Runs server-side only (API Routes).
 */
export function buildKafkaClient(conn: Connection): Kafka {
  const brokers = conn.brokers
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);

  const config: KafkaConfig = {
    clientId: `kafka-controller-${conn.id ?? "anon"}`,
    brokers,
  };

  // Authentication
  if (conn.authType === "PLAIN" || conn.authType === "SCRAM-SHA-256" || conn.authType === "SCRAM-SHA-512") {
    const mechanism =
      conn.authType === "PLAIN"
        ? "plain"
        : conn.authType === "SCRAM-SHA-256"
        ? "scram-sha-256"
        : "scram-sha-512";

    config.sasl = {
      mechanism,
      username: conn.username ?? "",
      password: conn.password ?? "",
    } as SASLOptions;
  }

  // SSL / TLS
  if (conn.authType === "SSL") {
    config.ssl = {
      rejectUnauthorized: conn.sslRejectUnauthorized ?? true,
      ...(conn.sslCa ? { ca: [conn.sslCa] } : {}),
      ...(conn.sslCert ? { cert: conn.sslCert } : {}),
      ...(conn.sslKey ? { key: conn.sslKey } : {}),
    };
  }

  // Silence noisy KafkaJS logs in production
  config.logLevel = 1; // ERROR only

  return new Kafka(config);
}
