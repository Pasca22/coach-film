import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

async function players() {
  const { body } = await call('GET', '/api/players');
  return {
    ours: body.filter((p) => p.team === 'us'),
    theirs: body.filter((p) => p.team === 'opponent'),
  };
}

test('players are seeded for both teams, ours first', async () => {
  const { status, body } = await call('GET', '/api/players');
  assert.equal(status, 200);
  assert.ok(body.length > 0);
  assert.equal(body[0].team, 'us');
  assert.ok(body.some((p) => p.team === 'opponent'));
});

test('create, filter, update and delete events', async () => {
  const { theirs } = await players();
  const created = await call('POST', '/api/events', {
    type: 'pick_and_roll', team: 'opponent', player_id: theirs[0].id, start_s: 100, end_s: 108,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.type, 'pick_and_roll');

  await call('POST', '/api/events', { type: 'assist', team: 'us', start_s: 50, end_s: 55 });

  const filtered = await call('GET', '/api/events?team=opponent&type=pick_and_roll');
  assert.deepEqual(filtered.body.map((e) => e.id), [created.body.id]);

  const all = await call('GET', '/api/events');
  assert.deepEqual(all.body.map((e) => e.start_s), [50, 100], 'sorted by start time');

  const moved = await call('PATCH', `/api/events/${created.body.id}`, { start_s: 98, end_s: 110 });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.start_s, 98);

  const switched = await call('PATCH', `/api/events/${created.body.id}`, { team: 'us' });
  assert.equal(switched.body.player_id, null, 'player from the other team is cleared');

  assert.equal((await call('DELETE', `/api/events/${created.body.id}`)).status, 204);
  assert.equal((await call('DELETE', `/api/events/${created.body.id}`)).status, 404);
});

test('event validation', async () => {
  const { ours } = await players();
  const bad = [
    { type: 'dunk', team: 'us', start_s: 1, end_s: 2 },
    { type: 'assist', team: 'them', start_s: 1, end_s: 2 },
    { type: 'assist', team: 'us', start_s: 5, end_s: 5 },
    { type: 'assist', team: 'us', start_s: -1, end_s: 2 },
    { type: 'assist', team: 'opponent', player_id: ours[0].id, start_s: 1, end_s: 2 },
    { type: 'assist', team: 'us', player_id: 9999, start_s: 1, end_s: 2 },
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
  const { ours, theirs } = await players();
  const event = (await call('POST', '/api/events', { type: 'points', team: 'us', start_s: 200, end_s: 207 })).body;

  const a = await call('POST', '/api/assignments', { event_id: event.id, player_id: ours[0].id, note: '  Watch the closeout  ' });
  assert.equal(a.status, 201);
  assert.equal(a.body.note, 'Watch the closeout');
  assert.equal(a.body.watched_at, null);
  assert.equal(a.body.event.start_s, 200);

  await call('POST', '/api/assignments', { event_id: event.id, player_id: ours[1].id });

  const dup = await call('POST', '/api/assignments', { event_id: event.id, player_id: ours[0].id });
  assert.equal(dup.status, 400);

  const opp = await call('POST', '/api/assignments', { event_id: event.id, player_id: theirs[0].id });
  assert.equal(opp.status, 400, 'cannot assign to an opponent');

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

test('bad JSON and unknown routes', async () => {
  const res = await fetch(`${base}/api/events`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope',
  });
  assert.equal(res.status, 400);
  assert.equal((await call('GET', '/api/nothing')).status, 404);
});
