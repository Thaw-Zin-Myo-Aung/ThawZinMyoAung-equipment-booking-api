import { Hono } from 'hono'
import type { Context } from 'hono'

type Bindings = { DB: D1Database }
type Env = { Bindings: Bindings }

type BookingRow = {
  id: string
  equipment_id: string
  borrower_name: string
  start_at: string
  end_at: string
  purpose: string
  created_at: string
}

const app = new Hono<Env>().basePath('/api')

// DB uses snake_case, API uses camelCase
const toBooking = (r: BookingRow) => ({
  id: r.id,
  equipmentId: r.equipment_id,
  borrowerName: r.borrower_name,
  startAt: r.start_at,
  endAt: r.end_at,
  purpose: r.purpose,
  createdAt: r.created_at,
})

// ---------- Validation helpers ----------

class ValidationError extends Error {}

const TEXT_LIMITS = { equipmentId: 50, borrowerName: 100, purpose: 500 } as const
type TextField = keyof typeof TEXT_LIMITS

// Must be a non-empty string (after trimming) within the length limit
function requireText(body: Record<string, unknown>, field: TextField): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} must be a non-empty string`)
  }
  if (value.trim().length > TEXT_LIMITS[field]) {
    throw new ValidationError(`${field} must be at most ${TEXT_LIMITS[field]} characters`)
  }
  return value.trim()
}

// ISO-8601 date-time WITH a timezone (Z or +hh:mm), e.g. 2026-10-20T09:00:00.000Z
const ISO_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

// Returns the time normalised to UTC "YYYY-MM-DDTHH:mm:ss.sssZ"
function requireDateTime(body: Record<string, unknown>, field: 'startAt' | 'endAt'): string {
  const value = body[field]
  const m = typeof value === 'string' ? ISO_DATETIME.exec(value) : null
  if (!m) {
    throw new ValidationError(
      `${field} must be an ISO-8601 date-time with timezone, e.g. 2026-10-20T09:00:00.000Z`
    )
  }
  // JS Date silently rolls 2026-02-30 over to 2026-03-02, so check the calendar day ourselves
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    throw new ValidationError(`${field} is not a real calendar date`)
  }
  return new Date(value as string).toISOString()
}

// Parse the JSON body; malformed JSON or a non-object body is a client error (400), not a crash
async function readJsonObject(c: Context<Env>): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new ValidationError('Request body must be valid JSON')
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }
  return body as Record<string, unknown>
}

function checkTimeOrder(startAt: string, endAt: string) {
  // Both values are normalised UTC ISO strings, so string comparison = time comparison
  if (startAt >= endAt) throw new ValidationError('startAt must be before endAt')
}

async function equipmentExists(db: D1Database, equipmentId: string) {
  return (await db.prepare('SELECT 1 FROM equipment WHERE id = ?').bind(equipmentId).first()) !== null
}

const CONFLICT_MSG = 'This equipment is already booked for an overlapping time'

// ---------- Equipment ----------

app.get('/equipment', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, location FROM equipment ORDER BY id'
  ).all()
  return c.json(results, 200)
})

// ---------- Bookings ----------

app.get('/bookings', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM bookings ORDER BY start_at'
  ).all<BookingRow>()
  return c.json(results.map(toBooking), 200)
})

app.get('/bookings/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(c.req.param('id'))
    .first<BookingRow>()
  if (!row) return c.json({ error: 'Booking not found' }, 404)
  return c.json(toBooking(row), 200)
})

app.post('/bookings', async (c) => {
  const body = await readJsonObject(c)

  const missing = ['equipmentId', 'borrowerName', 'startAt', 'endAt', 'purpose'].filter(
    (f) => body[f] === undefined || body[f] === null || body[f] === ''
  )
  if (missing.length > 0) {
    return c.json({ error: `Missing required field(s): ${missing.join(', ')}` }, 400)
  }

  const row: BookingRow = {
    id: crypto.randomUUID(),
    equipment_id: requireText(body, 'equipmentId'),
    borrower_name: requireText(body, 'borrowerName'),
    start_at: requireDateTime(body, 'startAt'),
    end_at: requireDateTime(body, 'endAt'),
    purpose: requireText(body, 'purpose'),
    created_at: new Date().toISOString(),
  }
  checkTimeOrder(row.start_at, row.end_at)

  if (!(await equipmentExists(c.env.DB, row.equipment_id))) {
    return c.json({ error: `Equipment '${row.equipment_id}' does not exist` }, 404)
  }

  // Overlap check and insert in ONE statement, so two simultaneous requests
  // cannot both pass the check. Overlap rule: existing.start < new.end AND existing.end > new.start
  const result = await c.env.DB.prepare(
    `INSERT INTO bookings (id, equipment_id, borrower_name, start_at, end_at, purpose, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM bookings WHERE equipment_id = ? AND start_at < ? AND end_at > ?
     )`
  )
    .bind(
      row.id, row.equipment_id, row.borrower_name, row.start_at, row.end_at, row.purpose, row.created_at,
      row.equipment_id, row.end_at, row.start_at
    )
    .run()
  if (result.meta.changes === 0) return c.json({ error: CONFLICT_MSG }, 409)

  return c.json(toBooking(row), 201)
})

app.patch('/bookings/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first<BookingRow>()
  if (!existing) return c.json({ error: 'Booking not found' }, 404)

  const body = await readJsonObject(c)
  const updatable = ['equipmentId', 'borrowerName', 'startAt', 'endAt', 'purpose']
  if (!updatable.some((f) => f in body)) {
    return c.json({ error: `Provide at least one field to update: ${updatable.join(', ')}` }, 400)
  }

  // Partial update: a field that is sent must be valid; a field not sent keeps its current value
  const updated: BookingRow = {
    ...existing,
    equipment_id: 'equipmentId' in body ? requireText(body, 'equipmentId') : existing.equipment_id,
    borrower_name: 'borrowerName' in body ? requireText(body, 'borrowerName') : existing.borrower_name,
    start_at: 'startAt' in body ? requireDateTime(body, 'startAt') : existing.start_at,
    end_at: 'endAt' in body ? requireDateTime(body, 'endAt') : existing.end_at,
    purpose: 'purpose' in body ? requireText(body, 'purpose') : existing.purpose,
  }
  // Validate the MERGED booking, e.g. a new startAt must still be before the existing endAt
  checkTimeOrder(updated.start_at, updated.end_at)

  if (!(await equipmentExists(c.env.DB, updated.equipment_id))) {
    return c.json({ error: `Equipment '${updated.equipment_id}' does not exist` }, 404)
  }

  // Same overlap rule, ignoring the booking being updated (id <> ?), done atomically in the UPDATE
  const result = await c.env.DB.prepare(
    `UPDATE bookings
     SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ?
     WHERE id = ?
       AND NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE equipment_id = ? AND id <> ? AND start_at < ? AND end_at > ?
       )`
  )
    .bind(
      updated.equipment_id, updated.borrower_name, updated.start_at, updated.end_at, updated.purpose,
      id,
      updated.equipment_id, id, updated.end_at, updated.start_at
    )
    .run()
  if (result.meta.changes === 0) return c.json({ error: CONFLICT_MSG }, 409)

  return c.json(toBooking(updated), 200)
})

app.delete('/bookings/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?')
    .bind(c.req.param('id'))
    .run()
  if (result.meta.changes === 0) return c.json({ error: 'Booking not found' }, 404)
  return c.body(null, 204)
})

// ---------- JSON for every error ----------

// Unknown routes (Hono's default is plain text "404 Not Found")
app.notFound((c) => c.json({ error: `Route ${c.req.method} ${c.req.path} not found` }, 404))

// Validation errors -> 400; anything unexpected -> 500 JSON without leaking internals
app.onError((err, c) => {
  if (err instanceof ValidationError) return c.json({ error: err.message }, 400)
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
