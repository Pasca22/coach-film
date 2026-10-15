import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ROSTER } from './seed.js';

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS players (
    id     INTEGER PRIMARY KEY,
    name   TEXT    NOT NULL,
    number INTEGER NOT NULL,
    team   TEXT    NOT NULL CHECK (team IN ('us', 'opponent'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY,
    type       TEXT    NOT NULL CHECK (type IN ('pick_and_roll', 'assist', 'points', 'possession')),
    team       TEXT    NOT NULL CHECK (team IN ('us', 'opponent')),
    player_id  INTEGER REFERENCES players(id) ON DELETE SET NULL,
    start_s    REAL    NOT NULL CHECK (start_s >= 0),
    end_s      REAL    NOT NULL CHECK (end_s > start_s),
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
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

/** Opens (or creates) the database, applies the schema and seeds the roster if empty. */
export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM players').get();
  if (n === 0) {
    const insert = db.prepare('INSERT INTO players (name, number, team) VALUES (?, ?, ?)');
    for (const p of ROSTER) insert.run(p.name, p.number, p.team);
  }
  return db;
}
