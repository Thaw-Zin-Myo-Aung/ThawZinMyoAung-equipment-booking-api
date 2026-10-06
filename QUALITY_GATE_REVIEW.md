# Quality Gate Review

- **Pre-Quality-Gate snapshot (minute 30):** commit `04dc9d3`. Improved version: commit `2694442` (`git diff 04dc9d3 2694442 -- src/index.ts`)
- **Method:** checked v1 against the 8 Quality Gate areas, then ran the curl guide plus edge cases on v1 ([before_v1.txt](evidence/before_v1.txt): 16 pass / 4 fail). I fixed the issues and re-ran everything ([after_v2.txt](evidence/after_v2.txt): 26 pass / 0 fail, plus the Postman screenshots in [TEST_EVIDENCE.md](TEST_EVIDENCE.md)).

| # | Quality Gate area | Finding | Action taken | Evidence |
|---|---|---|---|---|
| 1 | **Reliability** – handles invalid requests without crashing | A malformed JSON body (`{bad`) crashed the handler and returned a plain-text **500**. | Added `readJsonObject()`: if parsing fails or the body is not a JSON object, it throws a `ValidationError`, which `app.onError` turns into a JSON **400**. | E6: v1 500 → v2 400. Screenshot [15](evidence/screenshots/15-malformed-json-400.png) |
| 2 | **Accuracy** – every error uses `{ "error": "..." }` | Unknown routes returned Hono's default plain text `404 Not Found`, and unexpected errors returned plain-text 500. | Added `app.notFound` (JSON 404) and `app.onError` (JSON 400 for validation, generic JSON 500 otherwise, without leaking internals). | E9: v1 plain text → v2 JSON. Screenshot [16](evidence/screenshots/16-unknown-route-404.png) |
| 3 | **Accuracy** – fields contain correct values | v1 only checked that fields were "truthy", so `borrowerName: 123` was stored as a number and `"   "` was accepted. | `requireText()` checks that the value is a string, non-empty after trimming, and within a length limit (50/100/500). | E7: v1 201 → v2 400; E12 400. Screenshot [17](evidence/screenshots/17-wrong-type-400.png) |
| 4 | **Accuracy** – dates are correct | JavaScript `new Date()` silently changes **2026-02-30 to 2026-03-02**, and parses `"10/24/2026 09:00"` in the laptop's local timezone (+07). A booking could be saved at a different time than the user meant. | `requireDateTime()` requires strict ISO-8601 **with a timezone** (regex) and checks the day exists in that month. The value is then normalised to UTC `...Z`. | E8: v1 201 → v2 400; E11 (Feb 30) 400 |
| 5 | **Reliability** – updates are validated like creates | Code review of v1 PATCH (`body.x ?? existing.x`): sent fields were **not type-checked**, so `{"borrowerName": 123}` would be stored as a number. `null` was silently ignored instead of rejected, and an empty PATCH `{}` returned 200 without changing anything. *(v1 did already validate the merged start/end; I kept that behaviour.)* | Every field that is sent goes through the same `requireText` / `requireDateTime` as POST (checked with `'field' in body`, so `null` → 400). A PATCH with no updatable fields returns 400. The merged booking is still checked for start < end and overlap. | E13 `{}` 400, E14 merged start ≥ end 400, E2 409. Screenshot [11](evidence/screenshots/11-patch-overlap-409.png) |
| 6 | **Reliability** – no overlaps for the same equipment | v1 checked for an overlap with `SELECT`, then ran the `INSERT` as a separate statement. Two requests arriving at the same moment could both pass the check (check-then-write race). | The overlap condition is now inside the write itself: `INSERT ... SELECT ... WHERE NOT EXISTS (overlap)` and `UPDATE ... WHERE id = ? AND NOT EXISTS (overlap)`. If `meta.changes = 0`, the API returns 409. | Tests 7 / E2 still return 409, and E1 / E3 still return 201. *(Limitation: true simultaneity was not load-tested; the fix is by design.)* |
| 7 | **Reasoning** – why each status code | I had to decide what an unknown `equipmentId` returns: **404** or **400**. | Kept **404**: the request body is well-formed and valid, but it refers to equipment that does not exist, so the missing resource is reported as 404. 400 is used for data that is missing or malformed in itself. Documented in [API_CONTRACT.md](API_CONTRACT.md). | Screenshot [09](evidence/screenshots/09-unknown-equipment-404.png) |
| 8 | **Reasoning** – overlap check on update | An update must not conflict with **its own** old time slot. | The update overlap query excludes the booking being updated (`id <> ?`). Rule: `existing.start < new.end AND existing.end > new.start`, so back-to-back bookings are allowed. | Screenshot [11a](evidence/screenshots/11a-patch-self-not-conflict-200.png): A moved 09–11 → 10:30–11:30 gives 200. E1 back-to-back 201 |
| 9 | **You Own It** – verify AI output | My first AI-generated test script only compared status codes, so the v1 plain-text 404 (E9) was reported as **PASS** even though it broke the JSON-error rule. | Added a check that every expected error (≥ 400) has a `{"error":"..."}` body. Re-running v1 then correctly showed 4 failures instead of 3. | [before_v1.txt](evidence/before_v1.txt) E9 marked `body is NOT JSON {error}` |
| 10 | **Delivery / Reasoning** – CORS only if needed | Is CORS required? | Not added: I test with curl and Postman, not a browser, and the brief says CORS is only needed for a browser client. Adding it would be an unused feature. | — |

## Final check (8 areas)

| Area | Status |
|---|---|
| 1 Purpose | ✅ Routes, bodies and status codes match the common contract |
| 2 Reliability | ✅ No crash on bad input; overlap is blocked on create and update; equipmentId is checked |
| 3 Course Context | ✅ TypeScript + Hono + local D1; AI use recorded in [AI_LOG.md](AI_LOG.md) |
| 4 Reasoning | ✅ 400/404/409 explained; overlap rule and assumptions documented |
| 5 Execution Value | ✅ README run steps; all CRUD endpoints tested |
| 6 Accuracy | ✅ startAt < endAt; strict dates; JSON errors everywhere; all SQL uses `.bind()` |
| 7 Delivery Quality | ✅ Contract, ERD, evidence (14 screenshots + 2 curl logs) |
| 8 You Own It | ⬜ *Student to confirm after reviewing the code and finishing AI_LOG.md* |

**Submission decision:** READY, once area 8 has been confirmed.
