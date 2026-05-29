# SIHIYAN — SIHI Seeds AI Operations Platform

An internal AI-powered operations management platform for SIHI Seeds. Manages stock, dispatch tracking, inventory across warehouses, AI chat assistant (Gemini), OCR bill scanning, and AI-generated daily reports.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm --filter @workspace/sihiyan run dev` — run the frontend (served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_GEMINI_BASE_URL` + `AI_INTEGRATIONS_GEMINI_API_KEY` — provisioned via Replit Gemini integration

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS, shadcn/ui, Recharts, TanStack Query, wouter
- API: Express 5 (port 8080, base path `/api`)
- DB: PostgreSQL + Drizzle ORM
- AI: Google Gemini 2.5 Flash via `@workspace/integrations-gemini-ai`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all endpoints)
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (use for backend validation)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (use in frontend)
- `lib/db/src/schema/` — Drizzle ORM table schemas (stock, dispatch, inventory, reports, ocr, conversations, messages)
- `artifacts/api-server/src/routes/` — Express route handlers (stock, dispatch, inventory, dashboard, reports, ocr, gemini)
- `artifacts/sihiyan/src/pages/` — React page components (dashboard, stock, dispatch, inventory, ai, ocr, reports, settings)
- `artifacts/sihiyan/src/hooks/use-toast.ts` — toast hook (import from `@/hooks/use-toast`, NOT `@/components/ui/use-toast`)

## Architecture decisions

- Contract-first API: OpenAPI spec drives both Zod validation and React Query hooks via Orval codegen
- `@google/genai` must NOT be externalized in `artifacts/api-server/build.mjs` — remove `"@google/*"` from the external list so it bundles correctly
- Gemini SSE streaming uses `ai.models.generateContentStream()` with raw `res.write()` SSE events; frontend uses raw `fetch()` to handle the stream
- All numeric DB fields (quantity, price, etc.) are stored as `numeric` strings in Postgres; parse with `parseFloat(String(field))`
- Express 5: use `/{*splat}` wildcards, async handlers return `Promise<void>`, early returns require `res.status().json(); return;`

## Product

- **Dashboard** (`/`): KPI cards (stock, alerts, dispatches, bills), activity feed, Recharts area chart for trends
- **Stock** (`/stock`): Full CRUD for seed varieties, category filter, low-stock highlighting, quantity adjustment modal
- **Dispatch** (`/dispatch`): Create/edit/delete dispatches, inline status updates, color-coded status badges
- **Inventory** (`/inventory`): Multi-warehouse inventory records with batch/expiry tracking, warehouse management tab
- **AI Assistant** (`/ai`): Gemini-powered chat with SSE streaming, conversation sidebar, markdown rendering
- **OCR Scanner** (`/ocr`): Drag-and-drop image upload, Gemini Vision OCR, structured data extraction, scan history
- **AI Reports** (`/reports`): Gemini-generated daily ops reports with stock/dispatch insights and recommendations
- **Settings** (`/settings`): Platform info and tech stack display

## Seed Data

Database is pre-seeded with:
- 10 seed stock items (paddy, oilseed, cereal, vegetable, cash crop varieties)
- 5 warehouses across Karnataka
- 7 dispatches with various statuses
- 8 inventory records linked to stock items and warehouses

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `useToast` hook: import from `@/hooks/use-toast`, NOT `@/components/ui/use-toast`
- `@google/genai` must be bundled (not external) — see Architecture decisions above
- Zod schema naming: `ListXQueryParams`, `CreateXBody`, `UpdateXBody` (not `XInput`, `XParams`)
- DB table exports: `conversations`, `messages` (not `conversationsTable`, `messagesTable`)
- Always run `pnpm install --no-frozen-lockfile` after adding new workspace dependencies
- Run `pnpm approve-builds` if `@google/genai` build scripts are blocked

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `lib/integrations-gemini-ai/` for Gemini AI wiring patterns
