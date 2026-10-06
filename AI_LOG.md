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

## In my own words

- Why 404 for an unknown equipmentId: 404 matches the HTTP definition. RFC 9110 says 404 means the server didn't find a current representation for the target resource. In this case, the target resource is the booking for that equipmentId. If the equipmentId doesn't exist, then there is no booking resource to represent, so 404 is appropriate. A 400 would imply that the request was malformed or invalid, but here the request is well-formed; it's just that the resource doesn't exist.
- How the overlap check works (create and update): The overlap check works by querying the database for any existing bookings that have a time range that intersects with the requested booking's time range. When creating a new booking, the system checks if there are any existing bookings for the same equipmentId that have a start time before the requested end time and an end time after the requested start time. If such a booking exists, it indicates an overlap, and the request is rejected with an appropriate error message. For updates, the same logic applies, but it also excludes the current booking being updated from the overlap check to avoid false positives.
- Which AI suggestions I changed or rejected, and why: 
  - I rejected the AI's initial test script that only checked status codes because it did not verify the response body format. This led to false positives in the test results, so I added checks for JSON error bodies to ensure accurate validation.
  - I also rejected the AI's claim that v1 PATCH did not validate merged start/end dates. Upon reviewing the code, I found that it did perform validation, so I corrected the finding to reflect the actual issues with v1 PATCH (lack of type checks, ignoring null values, and accepting empty PATCH requests).
  - Additionally, I rejected the AI's suggestion to rely solely on JavaScript's `Date` parsing for date validation. After testing edge cases, I found that it could produce unexpected results, so I implemented strict ISO date validation instead.
