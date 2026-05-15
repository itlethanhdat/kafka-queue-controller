/**
 * CRUD wrappers for the connections table that transparently encrypt sensitive
 * fields on write and decrypt them on read.
 *
 * Sensitive fields: username, password, sslCa, sslCert, sslKey
 *
 * Migration strategy: if a field value is NOT a valid encrypted blob (i.e. it
 * was stored before this module was introduced) it is returned as-is. On the
 * next save it will be encrypted automatically.
 */

import { db } from "@/lib/db";
import type { Connection } from "@/lib/db";
import { encryptField, decryptField, isEncrypted, initCrypto } from "@/lib/crypto";

type SensitiveFields = "username" | "password" | "sslCa" | "sslCert" | "sslKey";

const SENSITIVE: SensitiveFields[] = [
  "username",
  "password",
  "sslCa",
  "sslCert",
  "sslKey",
];

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function encryptConnection(
  conn: Omit<Connection, "id" | "createdAt" | "updatedAt">
): Promise<Omit<Connection, "id" | "createdAt" | "updatedAt">> {
  await initCrypto();
  const result = { ...conn } as Record<string, unknown>;
  for (const field of SENSITIVE) {
    const val = conn[field];
    if (val) result[field] = await encryptField(val);
  }
  return result as Omit<Connection, "id" | "createdAt" | "updatedAt">;
}

async function decryptConnection(conn: Connection): Promise<Connection> {
  await initCrypto();
  const result = { ...conn } as Record<string, unknown>;
  for (const field of SENSITIVE) {
    const val = conn[field];
    if (val) {
      result[field] = isEncrypted(val) ? await decryptField(val) : val;
    }
  }
  return result as unknown as Connection;
}

// ─── Public CRUD API ──────────────────────────────────────────────────────────

/** Add a new connection — sensitive fields are encrypted before storage. */
export async function addConnection(
  conn: Omit<Connection, "id" | "createdAt" | "updatedAt">
): Promise<number> {
  const now = Date.now();
  const encrypted = await encryptConnection(conn);
  return db.connections.add({ ...encrypted, createdAt: now, updatedAt: now } as Connection);
}

/**
 * Update an existing connection — merges patch, encrypts sensitive fields.
 * Pass only the fields you want to change.
 */
export async function updateConnection(
  id: number,
  patch: Partial<Omit<Connection, "id" | "createdAt">>
): Promise<void> {
  const encryptedPatch: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
  for (const field of SENSITIVE) {
    const val = patch[field];
    if (val !== undefined) {
      encryptedPatch[field] = val ? await encryptField(val) : val;
    }
  }
  await db.connections.update(id, encryptedPatch as Partial<Connection>);
}

/** Get a single connection by id — decrypted. Returns undefined if not found. */
export async function getConnection(id: number): Promise<Connection | undefined> {
  const conn = await db.connections.get(id);
  if (!conn) return undefined;
  return decryptConnection(conn);
}

/** Return all connections ordered by name — decrypted. */
export async function getAllConnections(): Promise<Connection[]> {
  const conns = await db.connections.orderBy("name").toArray();
  return Promise.all(conns.map(decryptConnection));
}

/** Delete a connection by id. */
export async function deleteConnection(id: number): Promise<void> {
  await db.connections.delete(id);
}

/**
 * Export all connections as decrypted JSON (for portability — the exported
 * file contains plaintext credentials). Import will re-encrypt on the way in.
 */
export async function exportConnections(): Promise<Connection[]> {
  const conns = await db.connections.toArray();
  return Promise.all(conns.map(decryptConnection));
}

/**
 * Import connections from a plaintext array (e.g. from exportConnections /
 * manual JSON). Encrypts sensitive fields before storing.
 * Clears existing connections first.
 */
export async function importConnections(conns: Connection[]): Promise<void> {
  const encrypted = await Promise.all(
    conns.map(async (c) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = c;
      const enc = await encryptConnection(rest);
      const now = Date.now();
      return { ...enc, createdAt: _ca ?? now, updatedAt: _ua ?? now } as Connection;
    })
  );
  await db.connections.clear();
  await db.connections.bulkAdd(encrypted);
}
