# AI Log

Tool: Claude Code (Claude desktop app, Code tab), used as a development assistant.

| # | Prompt (summary) | What I used | What I verified myself |
|---|---|---|---|
| 1 | "I cannot install Claude Code terminal" | Diagnosis: Node.js was missing, so I installed Node LTS with `winget`. | Ran `node -v` and `npm -v` (v24.19.0 / 11.17.0). |
| 2 | "Let's carry out the lab together" + the exam brief | Project scaffold (Hono + Wrangler + local D1), the migration with seed data, the v1 `src/index.ts` CRUD, and the draft contract/schema docs. | Ran the migration (5 commands OK) and `tsc` with no errors, and checked the CRUD flows with curl: create 201, overlap 409, back-to-back 201, start≥end 400, missing equipment 404, patch 200, delete 204, get-after-delete 404. |
| 3 | (same session) Probing the v1 for weaknesses | AI-suggested probe requests | Found that malformed JSON gives a plain-text **500**, an unknown route gives plain-text **404**, and `borrowerName: 123` is **accepted**. All three are carried into the Quality Gate. |

<!-- TODO (student): in your own words, add which suggestions you rejected or changed, and why. -->
