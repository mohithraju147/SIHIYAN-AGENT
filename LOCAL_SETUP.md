# Running SIHIYAN Locally

## Prerequisites

- Node.js 20+ (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- pnpm 9+ → `npm install -g pnpm`
- PostgreSQL 15+ (local install or [Docker](#using-docker-for-postgres))

---

## 1. Install dependencies

```bash
pnpm install
```

## 2. Set up environment variables

Create a `.env` file in the **root** of the project:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:password@localhost:5432/sihiyan

# Gemini AI (get from Google AI Studio: https://aistudio.google.com/apikey)
AI_INTEGRATIONS_GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_INTEGRATIONS_GEMINI_API_KEY=your_gemini_api_key_here

# Slack (optional — paste your Slack Incoming Webhook URL)
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Required by the build system (do not change these values)
SESSION_SECRET=any_random_string_here
```

Also create `artifacts/api-server/.env` with the same variables (the API server reads from its own `.env`):

```bash
cp .env artifacts/api-server/.env
```

## 3. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

This creates all the tables in your PostgreSQL database.

## 4. Run the app

Open **two terminals**:

**Terminal 1 — API server (port 8080):**
```bash
pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — Frontend (port 5173):**
```bash
pnpm --filter @workspace/sihiyan run dev
```

Then open **http://localhost:5173** in your browser.

> The frontend proxies `/api` requests to port 8080 automatically via Vite's dev config.

---

## Using Docker for Postgres

If you don't have PostgreSQL installed:

```bash
docker run -d \
  --name sihiyan-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=sihiyan \
  -p 5432:5432 \
  postgres:15
```

Then use this `DATABASE_URL`:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/sihiyan
```

---

## Getting a Gemini API Key

1. Go to https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy and paste it into `AI_INTEGRATIONS_GEMINI_API_KEY`

---

## Project structure

```
artifacts/
  api-server/     → Express 5 API (runs on port 8080)
  sihiyan/        → React + Vite frontend
lib/
  db/             → Drizzle ORM schema + migrations
  api-spec/       → OpenAPI spec (source of truth)
  api-zod/        → Generated Zod validation schemas
  api-client-react/ → Generated React Query hooks
```
