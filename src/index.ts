import { Hono } from 'hono'

type Bindings = { DB: D1Database }

type BookingRow = {
  id: string
  equipment_id: string
  borrower_name: string
  start_at: string
  end_at: string
  purpose: string
  created_at: string
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

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
  const body = await c.req.json()
  const { equipmentId, borrowerName, startAt, endAt, purpose } = body

  if (!equipmentId || !borrowerName || !startAt || !endAt || !purpose) {
    return c.json(
      { error: 'equipmentId, borrowerName, startAt, endAt and purpose are required' },
      400
    )
  }

  const start = new Date(startAt)
  const end = new Date(endAt)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return c.json({ error: 'startAt and endAt must be valid ISO-8601 date-times' }, 400)
  }
  if (start >= end) {
    return c.json({ error: 'startAt must be before endAt' }, 400)
  }

  const equipment = await c.env.DB.prepare('SELECT id FROM equipment WHERE id = ?')
    .bind(equipmentId)
    .first()
  if (!equipment) {
    return c.json({ error: `Equipment '${equipmentId}' does not exist` }, 404)
  }

  // Two ranges overlap when: existing.start < new.end AND existing.end > new.start
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  const conflict = await c.env.DB.prepare(
    'SELECT id FROM bookings WHERE equipment_id = ? AND start_at < ? AND end_at > ?'
  )
    .bind(equipmentId, endIso, startIso)
    .first()
  if (conflict) {
    return c.json({ error: 'This equipment is already booked for an overlapping time' }, 409)
  }

  const row: BookingRow = {
    id: crypto.randomUUID(),
    equipment_id: equipmentId,
    borrower_name: borrowerName,
    start_at: startIso,
    end_at: endIso,
    purpose,
    created_at: new Date().toISOString(),
  }
  await c.env.DB.prepare(
    `INSERT INTO bookings (id, equipment_id, borrower_name, start_at, end_at, purpose, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(row.id, row.equipment_id, row.borrower_name, row.start_at, row.end_at, row.purpose, row.created_at)
    .run()

  return c.json(toBooking(row), 201)
})

app.patch('/bookings/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first<BookingRow>()
  if (!existing) return c.json({ error: 'Booking not found' }, 404)

  const body = await c.req.json()

  // Partial update: fields not sent keep their current value
  const equipmentId = body.equipmentId ?? existing.equipment_id
  const borrowerName = body.borrowerName ?? existing.borrower_name
  const purpose = body.purpose ?? existing.purpose
  const start = new Date(body.startAt ?? existing.start_at)
  const end = new Date(body.endAt ?? existing.end_at)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return c.json({ error: 'startAt and endAt must be valid ISO-8601 date-times' }, 400)
  }
  if (start >= end) {
    return c.json({ error: 'startAt must be before endAt' }, 400)
  }

  const equipment = await c.env.DB.prepare('SELECT id FROM equipment WHERE id = ?')
    .bind(equipmentId)
    .first()
  if (!equipment) {
    return c.json({ error: `Equipment '${equipmentId}' does not exist` }, 404)
  }

  // Same overlap rule, but ignore the booking being updated (id <> ?)
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  const conflict = await c.env.DB.prepare(
    'SELECT id FROM bookings WHERE equipment_id = ? AND id <> ? AND start_at < ? AND end_at > ?'
  )
    .bind(equipmentId, id, endIso, startIso)
    .first()
  if (conflict) {
    return c.json({ error: 'This equipment is already booked for an overlapping time' }, 409)
  }

  await c.env.DB.prepare(
    `UPDATE bookings
     SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ?
     WHERE id = ?`
  )
    .bind(equipmentId, borrowerName, startIso, endIso, purpose, id)
    .run()

  return c.json(
    toBooking({ ...existing, equipment_id: equipmentId, borrower_name: borrowerName, start_at: startIso, end_at: endIso, purpose }),
    200
  )
})

app.delete('/bookings/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?')
    .bind(c.req.param('id'))
    .run()
  if (result.meta.changes === 0) return c.json({ error: 'Booking not found' }, 404)
  return c.body(null, 204)
})

export default app
