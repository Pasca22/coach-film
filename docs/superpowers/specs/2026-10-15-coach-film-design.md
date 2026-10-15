# Coach Film — Design

Date: 2026-10-15

## Purpose

A localhost-only demo app that helps a basketball coach review one match video:
tag key events for both teams, filter them, and hand specific clips to individual
players with a note. Players see only what was assigned to them.

## Constraints

- Runs only on `127.0.0.1`. No login, no auth. A "Who's watching?" picker stands in for identity.
- React frontend, SQLite storage, minimal mainstream dependencies, exact pinned versions.
- Black-and-white visual theme. No accent colour.
- One local video file at `video/match.mp4` (not committed).
- "Mobile" means the same app at phone width (checked with Chrome DevTools device mode).

## Concepts

- **Event** — a tagged moment with a type (`pick_and_roll`, `assist`, `points`, `possession`),
  a team (`us`, `opponent`), an optional player, and a `start_s`/`end_s` window.
  An event *is* the clip; there is no separate cut step and no video re-encoding.
- **Assignment** — an event given to one of *our* players, with a coach note and a
  `watched_at` timestamp (null until the player marks it watched). Unique per event + player.
- **Player** — seeded roster for both teams (name, jersey number, team).

## Architecture

Single Node package, one process, one port (`127.0.0.1:3000`).

- `server/` — Express 5. Serves `/api/*`, streams `/video/match.mp4` (byte ranges via `express.static`),
  and in development mounts Vite in middleware mode (no proxy, no CORS). `--prod` serves `dist/`.
- SQLite through the built-in `node:sqlite` (Node ≥ 22.13), file `data/coach.db`. Schema is created
  on startup; the roster is seeded when the players table is empty.
- `client/` — Vite + React 19 + React Router 7, TypeScript, plain CSS with variables.

### Data model

| Table | Columns |
|---|---|
| players | id, name, number, team |
| events | id, type, team, player_id (nullable, must match event team), start_s, end_s (> start_s), created_at |
| assignments | id, event_id (cascade delete), player_id (must be team `us`), note, watched_at, created_at, UNIQUE(event_id, player_id) |

### API

- `GET /api/players`
- `GET /api/events?type=&team=&player=`, `POST /api/events`, `PATCH /api/events/:id`, `DELETE /api/events/:id`
- `GET /api/assignments?player=`, `POST /api/assignments`, `PATCH /api/assignments/:id` (`note`, `watched`), `DELETE /api/assignments/:id`
- `GET /api/video` → `{ available: boolean }`

Invalid input → `400 { error }`; unknown ids → `404 { error }`.

## Screens

- `/` — Who's watching: Coach card + one card per player on our team. Choice remembered in `localStorage`.
- `/coach` (wide screens) — workstation: video with custom controls and an event-marker timeline; tag bar
  (`1` P&R, `2` Assist, `3` Points, `4` Possession, `T` toggle team, optional player); event list with
  filter chips (type, team, player). Tagging creates `[t − 5s, t + 3s]`. Clicking an event plays exactly
  that segment and pauses at its end. The selected event can be edited (`[`/`]` set start/end to playhead),
  deleted (with confirm, cascades assignments), or assigned to one or more of our players with a note.
- `/coach/assignments` — grouped by player: clip, note (editable), watched state, remove, play.
  At phone width `/coach` shows only this view.
- `/player/:id` — "Your clips": list + clip player restricted to the clip window, coach note, Mark as watched.
  At phone width: list, tap to open the clip full-width.

Empty states: no video file → instructions; no events → "press 1–4 while watching"; no clips → "Nothing assigned yet".

## Testing

Vitest: API tests against an in-memory SQLite database (real HTTP via `fetch`), and unit tests for
pure client logic (time formatting, tag window clamping, event filtering). UI verified manually,
including phone width in DevTools.
