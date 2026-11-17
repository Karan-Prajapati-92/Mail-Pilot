import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import emailRoutes from './routes/emails.js';
import aiRoutes from './routes/ai.js';
import activityRoutes from './routes/activity.js';
import { aiProvider } from './services/ai.js';
import { startGmailPolling } from './services/gmail.js';

// Refuse to run in production with the built-in dev secret: anyone could forge login tokens with it.
if ((process.env.NODE_ENV === 'production' || process.env.RENDER) && !(process.env.JWT_SECRET || '').trim()) {
  console.error('[config] JWT_SECRET is empty. Set it in your host environment variables to any long random text (32+ characters), then redeploy.');
  process.exit(1);
}
if (!(process.env.JWT_SECRET || '').trim()) console.warn('[config] JWT_SECRET is empty: using an insecure dev default. Fine for local testing only.');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, ai: aiProvider() }));
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/activity', activityRoutes);

// Production: serve the built React app from this same server, so the browser calls /api on the
// same address (no CORS or API-URL setup needed). Unknown non-API paths fall back to index.html.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  console.log('[server] serving client from', dist);
}

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
await connectDB();
app.listen(PORT, '0.0.0.0', () => console.log(`[server] http://localhost:${PORT}  |  AI engine: ${aiProvider()}`));
startGmailPolling(Number(process.env.GMAIL_POLL_MS) || 60000);
