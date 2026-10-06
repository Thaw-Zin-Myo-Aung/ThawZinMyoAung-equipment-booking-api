#!/usr/bin/env bash
# Runs the cURL Quick Test Guide (steps 1-9) plus extra edge cases.
# Usage (Git Bash, server running):  bash tests/run_tests.sh [output-file]
# Each case prints: the request, the expected status, and the full response (curl -i).

BASE_URL="${BASE_URL:-http://localhost:8787/api}"
OUT="${1:-/dev/stdout}"
JSON='Content-Type: application/json'
PASS=0; FAIL=0

run() { # run "<title>" <expected-status> curl-args...
  local title="$1" expect="$2"; shift 2
  local resp code
  resp=$(curl -s -i "$@")
  code=$(printf '%s' "$resp" | head -1 | awk '{print $2}')
  local note=""
  # error responses must also be JSON: { "error": "..." }
  if [ "$expect" -ge 400 ] && ! printf '%s' "$resp" | tail -1 | grep -q '^{"error":"'; then note=" + body is NOT JSON {error}"; fi
  if [ "$code" = "$expect" ] && [ -z "$note" ]; then r="PASS"; PASS=$((PASS+1)); else r="FAIL"; FAIL=$((FAIL+1)); fi
  {
    echo "=================================================================="
    echo "[$r] $title  (expected $expect, got $code$note)"
    echo "\$ curl $*"
    echo "------------------------------------------------------------------"
    printf '%s\n\n' "$resp" | tr -d '\r'
  } >> "$OUT"
  LAST="$resp"
}

[ "$OUT" != /dev/stdout ] && : > "$OUT"
echo "Base URL: $BASE_URL   Run at: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT"

# ---------- cURL Quick Test Guide ----------
run "1. List equipment" 200 "$BASE_URL/equipment"
run "2. List bookings" 200 "$BASE_URL/bookings"
run "3. Create a booking" 201 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}'
BOOKING_ID=$(printf '%s' "$LAST" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "BOOKING_ID=$BOOKING_ID" >> "$OUT"
run "4. Get one booking" 200 "$BASE_URL/bookings/$BOOKING_ID"
run "5. Update a booking" 200 -X PATCH "$BASE_URL/bookings/$BOOKING_ID" -H "$JSON" -d '{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T12:00:00.000Z",
  "endAt": "2026-10-20T14:00:00.000Z",
  "purpose": "Updated class presentation"
}'
run "6. Invalid time range" 400 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-21T11:00:00.000Z",
  "endAt": "2026-10-21T09:00:00.000Z",
  "purpose": "Invalid time range test"
}'
run "7. Overlapping booking" 409 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-1",
  "borrowerName": "Suda Dee",
  "startAt": "2026-10-20T12:30:00.000Z",
  "endAt": "2026-10-20T13:30:00.000Z",
  "purpose": "Conflict test"
}'
run "8. Missing booking" 404 "$BASE_URL/bookings/not-found"

# ---------- Extra cases (Quality Gate) ----------
run "E1. Back-to-back booking (14:00 start = previous end) is allowed" 201 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-1", "borrowerName": "Suda Dee",
  "startAt": "2026-10-20T14:00:00.000Z", "endAt": "2026-10-20T15:00:00.000Z", "purpose": "Back-to-back"
}'
B2B_ID=$(printf '%s' "$LAST" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
run "E2. PATCH that moves a booking onto another booking" 409 -X PATCH "$BASE_URL/bookings/$BOOKING_ID" -H "$JSON" -d '{
  "startAt": "2026-10-20T13:30:00.000Z", "endAt": "2026-10-20T14:30:00.000Z"
}'
run "E3. Same time, different equipment is allowed" 201 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-2", "borrowerName": "Suda Dee",
  "startAt": "2026-10-20T12:00:00.000Z", "endAt": "2026-10-20T14:00:00.000Z", "purpose": "Other equipment"
}'
OTHER_ID=$(printf '%s' "$LAST" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
run "E4. Unknown equipmentId" 404 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-999", "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-22T09:00:00.000Z", "endAt": "2026-10-22T10:00:00.000Z", "purpose": "Ghost"
}'
run "E5. Missing required fields" 400 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{ "equipmentId": "eq-1" }'
run "E6. Malformed JSON body" 400 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{bad'
run "E7. Wrong type (borrowerName is a number)" 400 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-3", "borrowerName": 123,
  "startAt": "2026-10-23T09:00:00.000Z", "endAt": "2026-10-23T10:00:00.000Z", "purpose": "Type check"
}'
run "E8. Non-ISO date format" 400 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-3", "borrowerName": "Somchai Jaidee",
  "startAt": "10/24/2026 09:00", "endAt": "10/24/2026 10:00", "purpose": "Date format check"
}'
run "E9. Unknown route returns JSON" 404 "$BASE_URL/nope"
run "E11. Impossible calendar date (Feb 30)" 400 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-3", "borrowerName": "Somchai Jaidee",
  "startAt": "2026-02-30T09:00:00.000Z", "endAt": "2026-02-30T10:00:00.000Z", "purpose": "Date check"
}'
run "E12. Whitespace-only borrowerName" 400 -X POST "$BASE_URL/bookings" -H "$JSON" -d '{
  "equipmentId": "eq-3", "borrowerName": "   ",
  "startAt": "2026-10-25T09:00:00.000Z", "endAt": "2026-10-25T10:00:00.000Z", "purpose": "Blank name"
}'
run "E13. PATCH with no updatable fields" 400 -X PATCH "$BASE_URL/bookings/$BOOKING_ID" -H "$JSON" -d '{}'
run "E14. PATCH only startAt, after the existing endAt (merged range invalid)" 400 -X PATCH "$BASE_URL/bookings/$BOOKING_ID" -H "$JSON" -d '{
  "startAt": "2026-10-20T15:00:00.000Z"
}'
run "E15. PATCH a booking that does not exist" 404 -X PATCH "$BASE_URL/bookings/not-found" -H "$JSON" -d '{ "purpose": "x" }'
run "E16. DELETE a booking that does not exist" 404 -X DELETE "$BASE_URL/bookings/not-found"
run "E10. SQL injection attempt is treated as plain data" 404 "$BASE_URL/bookings/x'%20OR%20'1'='1"

# ---------- 9. Delete + cleanup ----------
run "9. Delete a booking" 204 -X DELETE "$BASE_URL/bookings/$BOOKING_ID"
run "9b. Get deleted booking" 404 "$BASE_URL/bookings/$BOOKING_ID"
for id in $B2B_ID $OTHER_ID; do curl -s -o /dev/null -X DELETE "$BASE_URL/bookings/$id"; done
# remove anything the probes wrongly created on eq-3 (v1 only)
for id in $(curl -s "$BASE_URL/bookings" | grep -o '"id":"[^"]*","equipmentId":"eq-3"' | cut -d'"' -f4); do
  curl -s -o /dev/null -X DELETE "$BASE_URL/bookings/$id"
done

echo "==================================================================" >> "$OUT"
echo "SUMMARY: $PASS passed, $FAIL failed" >> "$OUT"
[ "$OUT" != /dev/stdout ] && echo "SUMMARY: $PASS passed, $FAIL failed  -> $OUT"
