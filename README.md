# Campus Equipment Booking API

Backend REST API for booking shared equipment (projectors, cameras, rooms) without overlapping times.
Built with **TypeScript + Hono** on **Cloudflare Workers (Wrangler)** with a **local D1 (SQLite)** database.

| | Base URL |
|---|---|
| **Live (Cloudflare Workers + D1)** | **https://equipment-booking-api.platformdev.workers.dev/api** |
| Local (`wrangler dev`) | `http://localhost:8787/api` |

Quick check: https://equipment-booking-api.platformdev.workers.dev/api/equipment

## Run

Requires Node.js 20+.

```bash
npm install
npm run db:migrate   # create tables + seed 3 equipment records in local D1
npm run dev          # API at http://localhost:8787/api
```

To reset the database, stop the server, delete the `.wrangler/` folder, then run `npm run db:migrate` again.

> Windows PowerShell: if `npm` is blocked with "running scripts is disabled", use `npm.cmd run ...`.

## Deploy (Cloudflare)

```bash
npx wrangler login         # once, in the browser
npm run db:migrate:remote  # create tables + seed equipment in the remote D1 database
npm run deploy             # publishes to *.workers.dev
```

The D1 database `booking-db` (APAC) is configured in [wrangler.toml](wrangler.toml).

## Test

With the server running:

- **curl:** `bash tests/run_tests.sh evidence/after_v2.txt` (Git Bash). This runs the cURL Quick Test Guide steps 1–9 plus edge cases and prints PASS/FAIL for each.
  To test the live API: `BASE_URL=https://equipment-booking-api.platformdev.workers.dev/api bash tests/run_tests.sh`
- **Postman:** import [postman/booking-api.postman_collection.json](postman/booking-api.postman_collection.json) and an environment: `booking-api.postman_environment.json` (local) or `booking-api-cloudflare.postman_environment.json` (live). Then use **Run collection**.

Results and screenshots: [TEST_EVIDENCE.md](TEST_EVIDENCE.md)

## Project structure

| Path | What it is |
|---|---|
| [src/index.ts](src/index.ts) | All routes, validation and error handling |
| [migrations/0001_init.sql](migrations/0001_init.sql) | Schema + seed equipment |
| [wrangler.toml](wrangler.toml) | Worker + D1 binding (`DB`) |
| [tests/run_tests.sh](tests/run_tests.sh) | curl test script |
| [postman/](postman/) | Postman collection + environment |
| [evidence/](evidence/) | curl outputs (before/after) + screenshots |

## Documents

- API contract, assumptions, status codes: [API_CONTRACT.md](API_CONTRACT.md)
- Schema / ERD: [SCHEMA.md](SCHEMA.md)
- Test evidence: [TEST_EVIDENCE.md](TEST_EVIDENCE.md)
- Quality Gate review: [QUALITY_GATE_REVIEW.md](QUALITY_GATE_REVIEW.md)
- AI usage log: [AI_LOG.md](AI_LOG.md)

## Security notes

- Every SQL statement uses D1 parameter binding (`prepare('... ?').bind(value)`). Request data is never concatenated into SQL.
- Unexpected errors return a generic `{"error":"Internal server error"}`; details are logged on the server only.
- No CORS: the API is tested with curl/Postman, not a browser client.
- No authentication (out of scope for this lab).
