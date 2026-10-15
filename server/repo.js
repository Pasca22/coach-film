// Data access + validation. Every function takes the db as its first argument
// and throws ValidationError / NotFoundError, which the API maps to 400 / 404.

export const EVENT_TYPES = ['pick_and_roll', 'assist', 'points', 'possession'];
export const TEAMS = ['us', 'opponent'];
const MAX_NOTE_LENGTH = 1000;

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

const plain = (row) => (row ? { ...row } : row);

// ---------- players ----------

export function listPlayers(db) {
  return db
    .prepare("SELECT id, name, number, team FROM players ORDER BY team = 'opponent', number")
    .all()
    .map(plain);
}

function getPlayer(db, id) {
  return plain(db.prepare('SELECT id, name, number, team FROM players WHERE id = ?').get(id));
}

// ---------- events ----------

const EVENT_COLUMNS = 'id, type, team, player_id, start_s, end_s, created_at';

export function listEvents(db, filters = {}) {
  const where = [];
  const params = [];
  if (filters.type != null) {
    if (!EVENT_TYPES.includes(filters.type)) throw new ValidationError(`Unknown event type "${filters.type}"`);
    where.push('type = ?');
    params.push(filters.type);
  }
  if (filters.team != null) {
    if (!TEAMS.includes(filters.team)) throw new ValidationError(`Unknown team "${filters.team}"`);
    where.push('team = ?');
    params.push(filters.team);
  }
  if (filters.player != null) {
    where.push('player_id = ?');
    params.push(toId(filters.player, 'player'));
  }
  const sql = `SELECT ${EVENT_COLUMNS} FROM events ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY start_s`;
  return db.prepare(sql).all(...params).map(plain);
}

export function getEvent(db, id) {
  const row = db.prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE id = ?`).get(id);
  if (!row) throw new NotFoundError(`Event ${id} not found`);
  return plain(row);
}

function validateEvent(db, e) {
  if (!EVENT_TYPES.includes(e.type)) throw new ValidationError(`type must be one of ${EVENT_TYPES.join(', ')}`);
  if (!TEAMS.includes(e.team)) throw new ValidationError(`team must be one of ${TEAMS.join(', ')}`);
  if (!Number.isFinite(e.start_s) || e.start_s < 0) throw new ValidationError('start_s must be a number >= 0');
  if (!Number.isFinite(e.end_s) || e.end_s <= e.start_s) throw new ValidationError('end_s must be after start_s');
  if (e.player_id != null) {
    const player = getPlayer(db, e.player_id);
    if (!player) throw new ValidationError(`Player ${e.player_id} does not exist`);
    if (player.team !== e.team) throw new ValidationError(`Player #${player.number} is not on team "${e.team}"`);
  }
}

export function createEvent(db, input) {
  const e = {
    type: input?.type,
    team: input?.team,
    player_id: input?.player_id ?? null,
    start_s: input?.start_s,
    end_s: input?.end_s,
  };
  validateEvent(db, e);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO events (type, team, player_id, start_s, end_s) VALUES (?, ?, ?, ?, ?)')
    .run(e.type, e.team, e.player_id, e.start_s, e.end_s);
  return getEvent(db, Number(lastInsertRowid));
}

export function updateEvent(db, id, patch) {
  const current = getEvent(db, id);
  const e = { ...current };
  for (const key of ['type', 'team', 'player_id', 'start_s', 'end_s']) {
    if (patch && key in patch) e[key] = patch[key];
  }
  // Switching team clears a player that belongs to the other team.
  if (patch && 'team' in patch && !('player_id' in patch) && e.player_id != null) {
    if (getPlayer(db, e.player_id)?.team !== e.team) e.player_id = null;
  }
  validateEvent(db, e);
  db.prepare('UPDATE events SET type = ?, team = ?, player_id = ?, start_s = ?, end_s = ? WHERE id = ?')
    .run(e.type, e.team, e.player_id, e.start_s, e.end_s, id);
  return getEvent(db, id);
}

export function deleteEvent(db, id) {
  const { changes } = db.prepare('DELETE FROM events WHERE id = ?').run(id);
  if (!changes) throw new NotFoundError(`Event ${id} not found`);
}

// ---------- assignments ----------

const ASSIGNMENT_SELECT = `
  SELECT a.id, a.event_id, a.player_id, a.note, a.watched_at, a.created_at,
         e.type AS event_type, e.team AS event_team, e.player_id AS event_player_id,
         e.start_s, e.end_s
  FROM assignments a JOIN events e ON e.id = a.event_id`;

function shapeAssignment(row) {
  return {
    id: row.id,
    event_id: row.event_id,
    player_id: row.player_id,
    note: row.note,
    watched_at: row.watched_at,
    created_at: row.created_at,
    event: {
      type: row.event_type,
      team: row.event_team,
      player_id: row.event_player_id,
      start_s: row.start_s,
      end_s: row.end_s,
    },
  };
}

export function listAssignments(db, filters = {}) {
  if (filters.player != null) {
    return db
      .prepare(`${ASSIGNMENT_SELECT} WHERE a.player_id = ? ORDER BY a.created_at DESC, a.id DESC`)
      .all(toId(filters.player, 'player'))
      .map(shapeAssignment);
  }
  return db.prepare(`${ASSIGNMENT_SELECT} ORDER BY a.created_at DESC, a.id DESC`).all().map(shapeAssignment);
}

export function getAssignment(db, id) {
  const row = db.prepare(`${ASSIGNMENT_SELECT} WHERE a.id = ?`).get(id);
  if (!row) throw new NotFoundError(`Assignment ${id} not found`);
  return shapeAssignment(row);
}

function validateNote(note) {
  if (typeof note !== 'string') throw new ValidationError('note must be text');
  if (note.length > MAX_NOTE_LENGTH) throw new ValidationError(`note must be at most ${MAX_NOTE_LENGTH} characters`);
  return note.trim();
}

export function createAssignment(db, input) {
  const eventId = toId(input?.event_id, 'event_id');
  const playerId = toId(input?.player_id, 'player_id');
  const note = validateNote(input?.note ?? '');

  getEvent(db, eventId);
  const player = getPlayer(db, playerId);
  if (!player) throw new ValidationError(`Player ${playerId} does not exist`);
  if (player.team !== 'us') throw new ValidationError('Clips can only be assigned to players on your team');

  const exists = db.prepare('SELECT 1 FROM assignments WHERE event_id = ? AND player_id = ?').get(eventId, playerId);
  if (exists) throw new ValidationError(`${player.name} already has this clip`);

  const { lastInsertRowid } = db
    .prepare('INSERT INTO assignments (event_id, player_id, note) VALUES (?, ?, ?)')
    .run(eventId, playerId, note);
  return getAssignment(db, Number(lastInsertRowid));
}

export function updateAssignment(db, id, patch) {
  getAssignment(db, id);
  if (patch && 'note' in patch) {
    db.prepare('UPDATE assignments SET note = ? WHERE id = ?').run(validateNote(patch.note), id);
  }
  if (patch && 'watched' in patch) {
    if (typeof patch.watched !== 'boolean') throw new ValidationError('watched must be true or false');
    db.prepare(
      patch.watched
        ? "UPDATE assignments SET watched_at = COALESCE(watched_at, datetime('now')) WHERE id = ?"
        : 'UPDATE assignments SET watched_at = NULL WHERE id = ?',
    ).run(id);
  }
  return getAssignment(db, id);
}

export function deleteAssignment(db, id) {
  const { changes } = db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
  if (!changes) throw new NotFoundError(`Assignment ${id} not found`);
}

// ---------- helpers ----------

export function toId(value, name = 'id') {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`${name} must be a positive integer`);
  return n;
}
