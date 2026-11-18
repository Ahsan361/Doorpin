# Doorpin

Doorpin guides delivery riders all the way to the exact door, including the last stretch where normal maps fail. A sender draws the real path from their door out to an entry point, such as a society gate, adds landmarks and shares one link. The rider gets road directions to the entry point, then follows the drawn path, while the customer watches the rider arrive live. Riders need no app and no sign-up.

> Status: MVP Phase 0 (foundations). The map, API and database are set up; product features start in Phase 1.

## Tech stack

- **Web app:** Svelte + Vite (PWA), MapLibre GL JS, TypeScript
- **Server:** Node.js + Express 5, TypeScript (run directly by Node, no build step), Pino logging
- **Data:** PostgreSQL + PostGIS, Redis
- **Tooling:** npm workspaces, ESLint, Prettier, Vitest, Docker Compose

## Project layout

```
web/                 The web app that senders, riders and customers open
  src/map/           The map view and its default settings
server/              Express server: REST API now, live tracking later
  src/db/            Migration runner
  migrations/        Numbered SQL migrations, applied in order
shared/              Zod schemas used by both the web app and the server
compose.yaml         Local PostGIS and Redis
```

## Prerequisites

- Node.js 24 or newer
- npm (comes with Node.js)
- Docker Desktop, running

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file. The defaults work as they are for local development:

   ```bash
   cp .env.example .env
   ```

3. Start PostGIS and Redis, then apply the database migrations:

   ```bash
   npm run db:up
   npm run db:migrate
   ```

4. Start the server (http://127.0.0.1:3000) and the web app (http://127.0.0.1:5173), each in its own terminal:

   ```bash
   npm run dev:server
   ```

   ```bash
   npm run dev:web
   ```

5. Check that everything is connected:

   ```bash
   curl http://127.0.0.1:3000/api/v1/healthz
   ```

   It returns `{"status":"ok","checks":{"database":"ok","redis":"ok"}}`, or HTTP 503 naming the service that is down.

## Scripts

Run these from the repository root.

| Script                              | What it does                                                     |
| ----------------------------------- | ---------------------------------------------------------------- |
| `npm run dev:server`                | Run the server with auto-restart on changes                      |
| `npm run dev:web`                   | Run the web app with hot reload                                  |
| `npm run db:up` / `npm run db:down` | Start or stop local PostGIS and Redis                            |
| `npm run db:migrate`                | Apply new database migrations (safe to run repeatedly)           |
| `npm run check`                     | Type-check, lint and format check. Must pass before every commit |
| `npm test`                          | Run all tests. The server tests need `npm run db:up` first       |
| `npm run format`                    | Format all files with Prettier                                   |

## Configuration

All settings come from environment variables, listed with safe local defaults in [.env.example](.env.example). Never commit `.env`.

The server tests use a separate `doorpin_test` database on the same local server. They create it and apply the migrations on their own, and refuse any database whose name doesn't end in `_test`, so they never touch your development data.

Local PostGIS and Redis listen on ports **5433** and **6380**, bound to `127.0.0.1` only. The ports are not the usual 5432 and 6379, to avoid clashing with other local projects. Change `POSTGRES_PORT`, `REDIS_PORT` and the matching URLs in `.env` if you need different ones.

## Database migrations

Add a new file in `server/migrations` named with the next number, for example `0002_routes.sql`. Never edit a migration that has already been applied: the runner stores a checksum of each file and stops if an applied file changes.
