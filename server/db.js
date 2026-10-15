import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ROSTER } from './seed.js';

// players   = the coach's own roster (seeded).
// opponents = opposing players the coach adds for this game (never seeded).
const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS players (
    id     INTEGER PRIMARY KEY,
    name   TEXT    NOT NULL,
    number INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS opponents (
    id         INTEGER PRIMARY KEY,
    number     INTEGER NOT NULL UNIQUE CHECK (number BETWEEN 0 AND 99),
    name       TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY,
    type        TEXT    NOT NULL CHECK (type IN ('pick_and_roll', 'assist', 'points', 'possession')),
    team        TEXT    NOT NULL CHECK (team IN ('us', 'opponent')),
    player_id   INTEGER REFERENCES players(id) ON DELETE SET NULL,
    start_s     REAL    NOT NULL CHECK (start_s >= 0),
    end_s       REAL    NOT NULL CHECK (end_s > start_s),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    opponent_id INTEGER REFERENCES opponents(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id         INTEGER PRIMARY KEY,
    event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    note       TEXT    NOT NULL DEFAULT '',
    watched_at TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (event_id, player_id)
  );
`;

const columns = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

/**
 * Databases created before opponents were split out kept opposing players in `players`
 * (with a `team` column). Move them to `opponents` and re-point their events.
 */
function migrateLegacy(db) {
  if (!columns(db, 'events').includes('opponent_id')) {
    db.exec('ALTER TABLE events ADD COLUMN opponent_id INTEGER REFERENCES opponents(id) ON DELETE SET NULL');
  }
  if (!columns(db, 'players').includes('team')) return;

  db.exec('BEGIN');
  try {
    const legacy = db.prepare("SELECT id, name, number FROM players WHERE team = 'opponent'").all();
    const insert = db.prepare('INSERT OR IGNORE INTO opponents (number, name) VALUES (?, ?)');
    const byNumber = db.prepare('SELECT id FROM opponents WHERE number = ?');
    const repoint = db.prepare('UPDATE events SET opponent_id = ?, player_id = NULL WHERE player_id = ?');
    for (const p of legacy) {
      insert.run(p.number, p.name);
      repoint.run(byNumber.get(p.number).id, p.id);
    }
    db.prepare("DELETE FROM assignments WHERE player_id IN (SELECT id FROM players WHERE team = 'opponent')").run();
    db.prepare("DELETE FROM players WHERE team = 'opponent'").run();
    db.exec('ALTER TABLE players DROP COLUMN team');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Opens (or creates) the database, applies the schema and seeds the roster if empty. */
export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  migrateLegacy(db);

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM players').get();
  if (n === 0) {
    const insert = db.prepare('INSERT INTO players (name, number) VALUES (?, ?)');
    for (const p of ROSTER) insert.run(p.name, p.number);
  }
  return db;
}
