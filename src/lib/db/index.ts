import Dexie, { type Table } from "dexie";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthType = "NONE" | "PLAIN" | "SCRAM-SHA-256" | "SCRAM-SHA-512" | "SSL";

export interface Connection {
  id?: number;
  name: string;
  brokers: string; // comma-separated list
  authType: AuthType;
  // PLAIN / SCRAM
  username?: string;
  password?: string;
  // SSL/TLS
  sslCa?: string;
  sslCert?: string;
  sslKey?: string;
  sslRejectUnauthorized?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type TabType = "produce" | "consume";

export interface WorkspaceTab {
  id?: number;
  connectionId: number | null;
  type: TabType;
  title: string;
  config: string; // JSON blob – tab-specific settings
  order: number;
  createdAt: number;
}

export type TemplateType = "json-schema" | "mustache";

export interface Template {
  id?: number;
  name: string;
  type: TemplateType;
  content: string; // JSON Schema string or Mustache template string
  variables?: string; // JSON blob for Mustache variable→faker mappings
  createdAt: number;
  updatedAt: number;
}

export interface KafkaMessage {
  id?: number;
  tabId: number;
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: string | null;
  headers: string; // JSON blob
  timestamp: number;
  receivedAt: number;
}

// ─── DB ──────────────────────────────────────────────────────────────────────

const MESSAGE_LIMIT_PER_TAB = 5000;

class KafkaControllerDB extends Dexie {
  connections!: Table<Connection, number>;
  tabs!: Table<WorkspaceTab, number>;
  templates!: Table<Template, number>;
  messages!: Table<KafkaMessage, number>;

  constructor() {
    super("kafka-controller");
    this.version(1).stores({
      connections: "++id, name, createdAt",
      tabs: "++id, connectionId, order, createdAt",
      templates: "++id, name, type, createdAt",
      messages: "++id, tabId, receivedAt, [tabId+receivedAt]",
    });
  }
}

export const db = new KafkaControllerDB();

// ─── Message helpers ──────────────────────────────────────────────────────────

export async function addMessage(msg: Omit<KafkaMessage, "id">) {
  await db.messages.add(msg);

  // Enforce per-tab limit
  const count = await db.messages.where("tabId").equals(msg.tabId).count();
  if (count > MESSAGE_LIMIT_PER_TAB) {
    const oldest = await db.messages
      .where("tabId")
      .equals(msg.tabId)
      .sortBy("receivedAt");
    const toDelete = oldest.slice(0, count - MESSAGE_LIMIT_PER_TAB);
    await db.messages.bulkDelete(toDelete.map((m) => m.id!));
  }
}

export async function getMessagesForTab(tabId: number): Promise<KafkaMessage[]> {
  return db.messages.where("tabId").equals(tabId).sortBy("receivedAt");
}

export async function clearMessagesForTab(tabId: number) {
  await db.messages.where("tabId").equals(tabId).delete();
}

// ─── DB export / import ───────────────────────────────────────────────────────

export async function exportDB(): Promise<string> {
  const [connections, tabs, templates, messages] = await Promise.all([
    db.connections.toArray(),
    db.tabs.toArray(),
    db.templates.toArray(),
    db.messages.toArray(),
  ]);
  return JSON.stringify({ connections, tabs, templates, messages }, null, 2);
}

export async function importDB(json: string) {
  const data = JSON.parse(json) as {
    connections?: Connection[];
    tabs?: WorkspaceTab[];
    templates?: Template[];
    messages?: KafkaMessage[];
  };
  await db.transaction("rw", db.connections, db.tabs, db.templates, db.messages, async () => {
    await db.connections.clear();
    await db.tabs.clear();
    await db.templates.clear();
    await db.messages.clear();
    if (data.connections?.length) await db.connections.bulkAdd(data.connections);
    if (data.tabs?.length) await db.tabs.bulkAdd(data.tabs);
    if (data.templates?.length) await db.templates.bulkAdd(data.templates);
    if (data.messages?.length) await db.messages.bulkAdd(data.messages);
  });
}
