-- Equipment that can be booked (camera, projector, meeting room, ...)
CREATE TABLE IF NOT EXISTS equipment (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  location TEXT NOT NULL
);

-- One booking belongs to exactly one equipment (equipment 1 --- N bookings)
-- start_at / end_at are stored as ISO-8601 UTC strings (YYYY-MM-DDTHH:mm:ss.sssZ),
-- so they compare correctly as plain text.
CREATE TABLE IF NOT EXISTS bookings (
  id            TEXT PRIMARY KEY,
  equipment_id  TEXT NOT NULL REFERENCES equipment(id),
  borrower_name TEXT NOT NULL,
  start_at      TEXT NOT NULL,
  end_at        TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  CHECK (start_at < end_at)
);

-- Speeds up the overlap check, which always filters by equipment + time range
CREATE INDEX IF NOT EXISTS idx_bookings_equipment_time
  ON bookings (equipment_id, start_at, end_at);

-- Seed data: at least two equipment records
INSERT OR IGNORE INTO equipment (id, name, location) VALUES
  ('eq-1', 'Projector A', 'Building 1'),
  ('eq-2', 'Camera Canon EOS', 'Media Lab, Building 2'),
  ('eq-3', 'Meeting Room 301', 'Building 3');
