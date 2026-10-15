# Coach Film

A localhost-only demo for basketball coaches: watch a match, tag key events
(pick & roll, assist, points, possession) for your team and the opponent,
filter them, and send clips to individual players with a note.

- **Coach (PC):** tag with hotkeys while watching, trim clips, assign them to players.
- **Coach (phone width):** overview of everything assigned and who has watched it.
- **Player (PC and phone):** only the clips assigned to them, with the coach's note.

No login: pick who you are on the start screen. Runs only on `127.0.0.1`.

## Setup

Requires Node.js **22.13+** (uses the built-in `node:sqlite`).

```bash
npm install
```

Put the match video at `video/match.mp4` (git-ignored). To download one with
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and keep the audio, ffmpeg is needed to merge streams:

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
yt-dlp -f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]" --merge-output-format mp4 -o video/match.mp4 "<URL>"
```

## Run

```bash
npm run dev        # http://127.0.0.1:3000 (PORT env var to change)
npm test           # API tests (node:test, in-memory SQLite)
npm run typecheck  # client TypeScript check
npm run build && npm start   # production build served by Express
```

Data lives in `data/coach.db` (git-ignored). Delete it to start fresh; the roster
in `server/seed.js` is re-seeded automatically.

## Coach hotkeys

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `←` / `→` | Back / forward 5s (`Shift` = 1s) |
| `1` `2` `3` `4` | Tag pick & roll / assist / points / possession (5s before → 3s after the playhead) |
| `T` | Toggle team (Us / Opponent) for new tags |
| `[` / `]` | Set the selected event's start / end to the playhead |
| `Esc` | Deselect |

Phone layout: open Chrome DevTools → device toolbar (`Ctrl+Shift+M`).

## Stack

Express 5 · `node:sqlite` · React 19 · React Router 7 · Vite 8 · TypeScript · plain CSS.
Dependencies are pinned to exact versions and npm install scripts are disabled (`.npmrc`).
Design notes: [docs/superpowers/specs/2026-10-15-coach-film-design.md](docs/superpowers/specs/2026-10-15-coach-film-design.md).
