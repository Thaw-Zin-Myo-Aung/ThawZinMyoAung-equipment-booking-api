# Campus Equipment Booking API

Backend REST API for booking shared equipment (projectors, cameras, rooms). Built with **TypeScript + Hono** on **Cloudflare Workers (Wrangler)** with a **local D1 (SQLite)** database.

**Base URL:** `http://localhost:8787/api`

## Run

Requires Node.js 20+.

```bash
npm install
npm run db:migrate   # create tables + seed equipment in local D1
npm run dev          # http://localhost:8787/api
```

## Documents

- API contract and assumptions: [API_CONTRACT.md](API_CONTRACT.md)
- Schema / ERD: [SCHEMA.md](SCHEMA.md)
- AI usage log: [AI_LOG.md](AI_LOG.md)
