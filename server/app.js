import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as repo from './repo.js';

export const VIDEO_FILE = 'match.mp4';

/** Builds the Express app (API + video). The caller decides how the frontend is served. */
export function createApp({ db, videoDir }) {
  const app = express();
  app.disable('x-powered-by');

  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));

  const idParam = (req) => {
    try {
      return repo.toId(req.params.id);
    } catch {
      throw new repo.NotFoundError(`Not found: ${req.params.id}`);
    }
  };
  const optional = (v) => (v === undefined || v === '' ? undefined : v);

  api.get('/players', (req, res) => res.json(repo.listPlayers(db)));

  api.get('/events', (req, res) => {
    const { type, team, player } = req.query;
    res.json(repo.listEvents(db, { type: optional(type), team: optional(team), player: optional(player) }));
  });
  api.post('/events', (req, res) => res.status(201).json(repo.createEvent(db, req.body)));
  api.patch('/events/:id', (req, res) => res.json(repo.updateEvent(db, idParam(req), req.body)));
  api.delete('/events/:id', (req, res) => {
    repo.deleteEvent(db, idParam(req));
    res.status(204).end();
  });

  api.get('/assignments', (req, res) => res.json(repo.listAssignments(db, { player: optional(req.query.player) })));
  api.post('/assignments', (req, res) => res.status(201).json(repo.createAssignment(db, req.body)));
  api.patch('/assignments/:id', (req, res) => res.json(repo.updateAssignment(db, idParam(req), req.body)));
  api.delete('/assignments/:id', (req, res) => {
    repo.deleteAssignment(db, idParam(req));
    res.status(204).end();
  });

  api.get('/video', (req, res) => res.json({ available: existsSync(join(videoDir, VIDEO_FILE)) }));

  api.use((req, res) => res.status(404).json({ error: `No route ${req.method} /api${req.path}` }));
  api.use((err, req, res, _next) => {
    if (err instanceof repo.ValidationError) return res.status(400).json({ error: err.message });
    if (err instanceof repo.NotFoundError) return res.status(404).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  app.use('/api', api);
  // express.static supports HTTP Range requests, so seeking in a long video is instant.
  app.use('/video', express.static(videoDir, { index: false, fallthrough: false }));

  return app;
}
