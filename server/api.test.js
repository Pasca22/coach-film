import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from './db.js';
import { createApp } from './app.js';

let server;
let base;
let videoDir;

before(async () => {
  videoDir = mkdtempSync(join(tmpdir(), 'coach-film-test-'));
  const app = createApp({ db: openDb(':memory:'), videoDir });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  rmSync(videoDir, { recursive: true, force: true });
});

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const roster = async () => (await call('GET', '/api/players')).body;

test('only our roster is seeded; opponents start empty', async () => {
  const { status, body } = await call('GET', '/api/players');
  assert.equal(status, 200);
  assert.ok(body.length > 0);
  assert.ok(body.every((p) => !('team' in p)));
  assert.deepEqual((await call('GET', '/api/opponents')).body, []);
});

test('coach adds and removes opponents for the game', async () => {
  const a = await call('POST', '/api/opponents', { number: 5, name: '  Silva ' });
  assert.equal(a.status, 201);
  assert.deepEqual({ number: a.body.number, name: a.body.name }, { number: 5, name: 'Silva' });

  const b = await call('POST', '/api/opponents', { number: '12' });
  assert.equal(b.body.name, '');

  assert.equal((await call('POST', '/api/opponents', { number: 5 })).status, 400, 'duplicate number');
  assert.equal((await call('POST', '/api/opponents', { number: 100 })).status, 400);
  assert.equal((await call('POST', '/api/opponents', {})).status, 400);

  assert.deepEqual((await call('GET', '/api/opponents')).body.map((o) => o.number), [5, 12]);

  // Removing an opponent keeps their events, just unlinked.
  const ev = await call('POST', '/api/events', { type: 'points', team: 'opponent', opponent_id: b.body.id, start_s: 1, end_s: 3 });
  assert.equal((await call('DELETE', `/api/opponents/${b.body.id}`)).status, 204);
  const after = (await call('GET', '/api/events')).body.find((e) => e.id === ev.body.id);
  assert.equal(after.opponent_id, null);
  await call('DELETE', `/api/events/${ev.body.id}`);
  await call('DELETE', `/api/opponents/${a.body.id}`);
});

test('create, filter, update and delete events', async () => {
  const opp = (await call('POST', '/api/opponents', { number: 8 })).body;
  const created = await call('POST', '/api/events', {
    type: 'pick_and_roll', team: 'opponent', opponent_id: opp.id, start_s: 100, end_s: 108,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.opponent_id, opp.id);

  const [me] = await roster();
  await call('POST', '/api/events', { type: 'assist', team: 'us', player_id: me.id, start_s: 50, end_s: 55 });

  const filtered = await call('GET', '/api/events?team=opponent&type=pick_and_roll');
  assert.deepEqual(filtered.body.map((e) => e.id), [created.body.id]);
  assert.deepEqual((await call('GET', `/api/events?opponent=${opp.id}`)).body.map((e) => e.id), [created.body.id]);
  assert.equal((await call('GET', `/api/events?player=${me.id}`)).body.length, 1);

  const all = await call('GET', '/api/events');
  assert.deepEqual(all.body.map((e) => e.start_s), [50, 100], 'sorted by start time');

  const moved = await call('PATCH', `/api/events/${created.body.id}`, { start_s: 98, end_s: 110 });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.start_s, 98);

  const switched = await call('PATCH', `/api/events/${created.body.id}`, { team: 'us' });
  assert.equal(switched.body.opponent_id, null, 'opponent is dropped when switching to us');

  assert.equal((await call('DELETE', `/api/events/${created.body.id}`)).status, 204);
  assert.equal((await call('DELETE', `/api/events/${created.body.id}`)).status, 404);
  for (const e of (await call('GET', '/api/events')).body) await call('DELETE', `/api/events/${e.id}`);
  await call('DELETE', `/api/opponents/${opp.id}`);
});

test('event validation', async () => {
  const [me] = await roster();
  const bad = [
    { type: 'dunk', team: 'us', start_s: 1, end_s: 2 },
    { type: 'assist', team: 'them', start_s: 1, end_s: 2 },
    { type: 'assist', team: 'us', start_s: 5, end_s: 5 },
    { type: 'assist', team: 'us', start_s: -1, end_s: 2 },
    { type: 'assist', team: 'opponent', player_id: me.id, start_s: 1, end_s: 2 },
    { type: 'assist', team: 'us', opponent_id: 1, start_s: 1, end_s: 2 },
    { type: 'assist', team: 'us', player_id: 9999, start_s: 1, end_s: 2 },
    { type: 'assist', team: 'opponent', opponent_id: 9999, start_s: 1, end_s: 2 },
  ];
  for (const body of bad) {
    const res = await call('POST', '/api/events', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok(res.body.error);
  }
  assert.equal((await call('GET', '/api/events?type=dunk')).status, 400);
  assert.equal((await call('PATCH', '/api/events/abc', {})).status, 404);
});

test('assignments: create, list per player, note, watched, cascade', async () => {
  const ours = await roster();
  const event = (await call('POST', '/api/events', { type: 'points', team: 'us', start_s: 200, end_s: 207 })).body;

  const a = await call('POST', '/api/assignments', { event_id: event.id, player_id: ours[0].id, note: '  Watch the closeout  ' });
  assert.equal(a.status, 201);
  assert.equal(a.body.note, 'Watch the closeout');
  assert.equal(a.body.watched_at, null);
  assert.equal(a.body.event.start_s, 200);

  await call('POST', '/api/assignments', { event_id: event.id, player_id: ours[1].id });

  const dup = await call('POST', '/api/assignments', { event_id: event.id, player_id: ours[0].id });
  assert.equal(dup.status, 400);

  const ghost = await call('POST', '/api/assignments', { event_id: event.id, player_id: 9999 });
  assert.equal(ghost.status, 400, 'unknown player');

  const mine = await call('GET', `/api/assignments?player=${ours[0].id}`);
  assert.deepEqual(mine.body.map((x) => x.id), [a.body.id]);

  const watched = await call('PATCH', `/api/assignments/${a.body.id}`, { watched: true, note: 'Updated' });
  assert.ok(watched.body.watched_at);
  assert.equal(watched.body.note, 'Updated');

  const unwatched = await call('PATCH', `/api/assignments/${a.body.id}`, { watched: false });
  assert.equal(unwatched.body.watched_at, null);

  assert.equal((await call('PATCH', `/api/assignments/${a.body.id}`, { watched: 'yes' })).status, 400);

  await call('DELETE', `/api/events/${event.id}`);
  const after = await call('GET', '/api/assignments');
  assert.ok(!after.body.some((x) => x.event_id === event.id), 'deleting an event removes its assignments');
});

test('video status and range requests', async () => {
  assert.deepEqual((await call('GET', '/api/video')).body, { available: false });

  writeFileSync(join(videoDir, 'match.mp4'), Buffer.alloc(1000, 1));
  assert.deepEqual((await call('GET', '/api/video')).body, { available: true });

  const res = await fetch(`${base}/video/match.mp4`, { headers: { range: 'bytes=100-199' } });
  assert.equal(res.status, 206);
  assert.equal((await res.arrayBuffer()).byteLength, 100);
});

test('legacy databases move opponents out of the roster', () => {
  const dir = mkdtempSync(join(tmpdir(), 'coach-film-legacy-'));
  const file = join(dir, 'old.db');
  const old = new DatabaseSync(file);
  old.exec(`
    CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT NOT NULL, number INTEGER NOT NULL,
      team TEXT NOT NULL CHECK (team IN ('us', 'opponent')));
    CREATE TABLE events (id INTEGER PRIMARY KEY, type TEXT NOT NULL, team TEXT NOT NULL,
      player_id INTEGER REFERENCES players(id) ON DELETE SET NULL, start_s REAL NOT NULL, end_s REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO players VALUES (1, 'Ours', 3, 'us'), (2, 'Theirs', 5, 'opponent');
    INSERT INTO events (type, team, player_id, start_s, end_s) VALUES ('assist', 'us', 1, 1, 2), ('points', 'opponent', 2, 3, 4);
  `);
  old.close();

  const db = openDb(file);
  assert.deepEqual(db.prepare('SELECT id, name, number FROM players').all().map((r) => ({ ...r })), [{ id: 1, name: 'Ours', number: 3 }]);
  const [opp] = db.prepare('SELECT id, number, name FROM opponents').all();
  assert.equal(opp.number, 5);
  const events = db.prepare('SELECT team, player_id, opponent_id FROM events ORDER BY id').all().map((r) => ({ ...r }));
  assert.deepEqual(events, [
    { team: 'us', player_id: 1, opponent_id: null },
    { team: 'opponent', player_id: null, opponent_id: opp.id },
  ]);
  db.close();
  openDb(file).close(); // running again is a no-op
  rmSync(dir, { recursive: true, force: true });
});

test('bad JSON and unknown routes', async () => {
  const res = await fetch(`${base}/api/events`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope',
  });
  assert.equal(res.status, 400);
  assert.equal((await call('GET', '/api/nothing')).status, 404);
});
