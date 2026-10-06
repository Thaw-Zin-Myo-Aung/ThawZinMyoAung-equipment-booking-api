# AI Log

**Tool:** Claude Code (Claude desktop app, Code tab), used as a development assistant.
**Rule I followed:** I ran every AI-generated change myself and only kept it after the test results matched what I expected.

| # | Prompt (summary) | What I used | What I verified myself |
|---|---|---|---|
| 1 | "I cannot install Claude Code terminal" | Diagnosis: Node.js was missing. I installed Node LTS with `winget`. | `node -v` / `npm -v` → v24.19.0 / 11.17.0 |
| 2 | "Let's carry out the lab together" + exam brief | Project scaffold (Hono + Wrangler + local D1), migration with seed data, v1 CRUD in `src/index.ts`, draft contract/schema docs. | Migration applied (5 commands OK), `tsc` with no errors, and manual curl checks of create/overlap/back-to-back/invalid range/patch/delete. Committed as the minute-30 snapshot `04dc9d3`. |
| 3 | Probing v1 for weaknesses | AI-suggested edge-case requests | Confirmed myself: malformed JSON → plain-text 500, unknown route → plain-text 404, `borrowerName: 123` accepted |
| 4 | "Give me commands, I will run the server myself" / PowerShell errors | Fix for an old PATH in the terminal; explanation of the `npm.ps1` execution-policy error | I changed the execution policy myself (`RemoteSigned`, CurrentUser) and started the server with `npm run dev` |
| 5 | "Create a Postman collection" | Postman collection (19 requests with test scripts, auto-captured booking ids) + environment file | Imported and ran it in Postman, and took the screenshots in `evidence/screenshots/` |
| 6 | Quality Gate + curl guide released → "fix the code first" | v2 fixes: JSON body parsing, `notFound`/`onError`, `requireText`, strict ISO dates, PATCH validation, atomic overlap SQL; curl test script `tests/run_tests.sh` | Before/after runs: v1 16 pass / 4 fail → v2 26 pass / 0 fail. Re-ran all Postman requests on v2 (all expected statuses). |
| 7 | 404 vs 400 for an unknown `equipmentId` | AI kept v1's 404 and pointed out that my first reasoning talked about IDs in the **URL path**, while here the id is in the **request body** | **My decision:** keep 404. *(reason in my own words below)* |

## Where I did not just accept the AI output

- **Test script false pass:** the first AI test script only compared status codes, so v1's plain-text 404 was reported as PASS. We added a check that error bodies are JSON `{error}`. After that, v1 correctly showed 4 failures.
- **Wrong claim in a draft review:** the AI's first draft of Quality Gate finding #5 said v1 PATCH did not validate the merged start/end. Checking the v1 code (`git show 04dc9d3:src/index.ts`) showed that it **did**. The finding was rewritten to the real v1 PATCH problems (no type checks, `null` ignored, empty PATCH accepted), and those were verified with curl on v2.
- **Date parsing:** I checked how JavaScript's `Date` parses edge cases in Node before relying on it. `2026-02-30` became March 2, and `10/20/2026` was parsed in local time (+07). This is why strict validation was added instead of trusting `new Date()`.

## In my own words (student to complete)

<!-- TODO (student): fill these in yourself — they are checked under "You Own It". -->
- Why 404 for an unknown equipmentId:
- How the overlap check works (create and update):
- Which AI suggestions I changed or rejected, and why:
