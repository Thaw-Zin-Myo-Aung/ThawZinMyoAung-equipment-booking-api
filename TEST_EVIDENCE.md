# Test Evidence

**Base URL used for the evidence: `https://equipment-booking-api.platformdev.workers.dev/api`** (Cloudflare Workers + remote D1)

- All screenshots in section 1 were taken against this **live** URL, with the Postman environment **"Booking API - Cloudflare (live)"**. The URL is shown in the `{{baseUrl}}` tooltip or in the environment name at the top right.
- Full curl suite against the live URL: **26 passed, 0 failed**, see [evidence/deployed_cloudflare.txt](evidence/deployed_cloudflare.txt).
- Development and the before/after Quality Gate comparison used the local server `http://localhost:8787/api` (section 2). The earlier localhost screenshots are kept in [evidence/screenshots/local/](evidence/screenshots/local/).

**Tools:** Postman (collection in [postman/](postman/)) and `curl` (script [tests/run_tests.sh](tests/run_tests.sh), based on the cURL Quick Test Guide)

## 1. Postman screenshots (v2, live Cloudflare URL)

**Full collection run (Postman Runner, environment "Booking API - Cloudflare (live)"): 34 tests, 0 failed, 0 errors.** The probe-cleanup request was skipped because #17 correctly did not create a booking.
Screenshot: [00-collection-run-34-passed.png](evidence/screenshots/00-collection-run-34-passed.png)

Individual requests:

| # | Case | Request | Expected | Result | Evidence |
|---|---|---|---:|---:|---|
| 01 | List equipment | `GET /equipment` | 200 | 200 ✅ | [01-equipment-200.png](evidence/screenshots/01-equipment-200.png) |
| 02 | **Create** booking | `POST /bookings` | 201 | 201 ✅ | [02-create-201.png](evidence/screenshots/02-create-201.png) |
| 04 | **Read** one booking | `GET /bookings/:id` | 200 | 200 ✅ | [04-get-by-id-200.png](evidence/screenshots/04-get-by-id-200.png) |
| 05 | **Conflict** on create (10:00–12:00 vs 09:00–11:00) | `POST /bookings` | 409 | 409 ✅ | [05-overlap-409.png](evidence/screenshots/05-overlap-409.png) |
| 06 | Back-to-back booking (starts exactly when A ends) is allowed | `POST /bookings` | 201 | 201 ✅ | [06-back-to-back-201.png](evidence/screenshots/06-back-to-back-201.png) |
| 07 | **Invalid input**: startAt after endAt | `POST /bookings` | 400 | 400 ✅ | [07-invalid-range-400.png](evidence/screenshots/07-invalid-range-400.png) |
| 09 | equipmentId does not exist | `POST /bookings` | 404 | 404 ✅ | [09-unknown-equipment-404.png](evidence/screenshots/09-unknown-equipment-404.png) |
| 10 | **Update** (partial, purpose only) | `PATCH /bookings/:id` | 200 | 200 ✅ | [10-patch-purpose-200.png](evidence/screenshots/10-patch-purpose-200.png) |
| 11a | Update overlapping only its **own** old time is not a conflict (run after C was deleted; this request's scripted tests expect the 409 case, so they show 0/2 here) | `PATCH /bookings/:id` | 200 | 200 ✅ | [11a-patch-self-not-conflict-200.png](evidence/screenshots/11a-patch-self-not-conflict-200.png) |
| 11 | **Conflict** on update (move A onto C) | `PATCH /bookings/:id` | 409 | 409 ✅ | [11-patch-overlap-409.png](evidence/screenshots/11-patch-overlap-409.png) |
| 12 | **Delete** | `DELETE /bookings/:id` | 204 | 204 ✅ | [12-delete-204.png](evidence/screenshots/12-delete-204.png) |
| 13 | **Not found** after delete | `GET /bookings/:id` | 404 | 404 ✅ | [13-get-deleted-404.png](evidence/screenshots/13-get-deleted-404.png) |
| 15 | Malformed JSON body (QG fix) | `POST /bookings` | 400 | 400 ✅ | [15-malformed-json-400.png](evidence/screenshots/15-malformed-json-400.png) |
| 16 | Unknown route returns JSON (QG fix) | `GET /nope` | 404 | 404 ✅ | [16-unknown-route-404.png](evidence/screenshots/16-unknown-route-404.png) |
| 17 | Wrong type `borrowerName: 123` (QG fix) | `POST /bookings` | 400 | 400 ✅ | [17-wrong-type-400.png](evidence/screenshots/17-wrong-type-400.png) |

Every Postman request also runs automated tests: the status code, the `{ "error": string }` body for errors, and the booking fields for successes.

## 2. curl test run: before vs after the Quality Gate

`bash tests/run_tests.sh <output-file>` runs curl guide steps 1–9 plus extra edge cases, and saves the full `curl -i` output, including headers.

| Run | Code version | Result | Full output |
|---|---|---|---|
| Before | v1 (commit `04dc9d3`) | **16 passed, 4 failed** | [evidence/before_v1.txt](evidence/before_v1.txt) |
| After | v2 (commit `2694442`) | **26 passed, 0 failed** | [evidence/after_v2.txt](evidence/after_v2.txt) |
| Live | v2 deployed to Cloudflare | **26 passed, 0 failed** | [evidence/deployed_cloudflare.txt](evidence/deployed_cloudflare.txt) |

Cases that failed on v1:

| Case | v1 | v2 |
|---|---|---|
| E6 malformed JSON | 500, plain text `Internal Server Error` | 400 `{"error":"Request body must be valid JSON"}` |
| E7 `borrowerName: 123` | 201 (stored a number) | 400 `{"error":"borrowerName must be a non-empty string"}` |
| E8 `"10/24/2026 09:00"` | 201 (parsed in local +07 timezone) | 400 `{"error":"startAt must be an ISO-8601 date-time with timezone, ..."}` |
| E9 unknown route | 404, plain text `404 Not Found` | 404 `{"error":"Route GET /api/nope not found"}` |

Cases added in v2 to cover the new rules: E11 (Feb 30), E12 (whitespace-only name), E13 (empty PATCH), E14 (PATCH that makes start ≥ end), E15/E16 (PATCH/DELETE of a missing booking). E10 shows that an SQL-injection string in the id is treated as plain data and returns 404.
