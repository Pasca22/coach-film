import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApp, VIDEO_FILE } from './app.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HOST = '127.0.0.1'; // localhost only — never reachable from other machines
const PORT = Number(process.env.PORT) || 3000;
const prod = process.argv.includes('--prod');

const db = openDb(join(ROOT, 'data', 'coach.db'));
const videoDir = join(ROOT, 'video');
const app = createApp({ db, videoDir });
const server = createServer(app);

if (prod) {
  const dist = join(ROOT, 'dist');
  app.use(express.static(dist));
  app.use((req, res) => res.sendFile(join(dist, 'index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    configFile: join(ROOT, 'vite.config.js'),
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use — is Coach Film already running? Stop it, or use another port:`);
    console.error(`  PowerShell:  $env:PORT=3001; npm run dev\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Coach Film running at http://${HOST}:${PORT}  (${prod ? 'production' : 'dev'})`);
  console.log(`  Video file: ${join(videoDir, VIDEO_FILE)}\n`);
});
