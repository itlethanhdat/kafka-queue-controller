# Kafka Queue Controller

A browser-based Kafka producer/consumer workbench built with Next.js. Manage multiple Kafka connections, produce and consume messages, persist history locally via IndexedDB, and generate payloads from JSON Schema or Mustache templates.

## Features

- **Multiple connections** — create, edit, delete, import/export Kafka connections with full auth support (NONE, PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, SSL/mTLS)
- **Produce tab** — send single or batch messages with repeat count & delay; value modes: raw text, JSON Schema (random generation), Mustache template
- **Consume tab** — SSE-based live consumer with auto-refresh; virtual scrolled message list (up to 5000 messages/tab with FIFO eviction); per-message JSON Schema / Mustache validation
- **Template system** — full CRUD for reusable JSON Schema and Mustache templates stored in IndexedDB
- **Workspace tabs** — open multiple produce/consume tabs simultaneously; tab state persisted across reloads
- **Topic picker** — live topic listing with search and manual refresh
- **Full import/export** — backup/restore entire database (connections + templates + history) as JSON

## Requirements

- Node.js 18+

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production Build

```bash
npm install
npm run build
```

The build produces a [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output#standalone) at `.next/standalone/`.

Run the standalone server:

```bash
node ".next/standalone/server.js"
```

Default port is **3000**. Override with the `PORT` env var:

```bash
PORT=8080 node ".next/standalone/server.js"
```

## Environment Variables

No required environment variables. All Kafka connection credentials are entered in the UI and stored in browser IndexedDB.

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| UI components | shadcn/ui v5 + @base-ui/react |
| Icons | lucide-react |
| Local storage | Dexie.js + dexie-react-hooks (IndexedDB) |
| Global state | Zustand |
| Kafka client | kafkajs (server-side API routes only) |
| Schema generation | json-schema-faker |
| Schema validation | ajv |
| Template rendering | mustache + @faker-js/faker |
| Code editor | @monaco-editor/react |
| Virtual list | @tanstack/react-virtual |
| Toasts | sonner |

## Project Structure

```
src/
├── app/
│   ├── api/kafka/
│   │   ├── consume/route.ts      # SSE stream
│   │   ├── send/route.ts         # Produce messages
│   │   ├── test-connection/route.ts
│   │   ├── test-consumer/route.ts
│   │   ├── test-producer/route.ts
│   │   └── topics/route.ts       # List topics
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── connections/
│   │   ├── ConnectionForm.tsx    # Create/edit dialog
│   │   └── ConnectionSidebar.tsx # Left sidebar
│   ├── consume/
│   │   └── ConsumeTab.tsx
│   ├── produce/
│   │   └── ProduceTab.tsx
│   ├── shared/
│   │   └── TopicPicker.tsx
│   ├── templates/
│   │   └── TemplatesManager.tsx
│   └── workspace/
│       ├── EmptyWorkspace.tsx
│       ├── WorkspaceShell.tsx
│       └── WorkspaceTabs.tsx
└── lib/
    ├── db/index.ts               # Dexie schema + helpers
    ├── kafka/client.ts           # kafkajs client builder
    ├── store/workspace.ts        # Zustand store
    └── templates/
        ├── json-schema.ts
        └── mustache.ts
```
