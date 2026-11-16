import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import emailRoutes from './routes/emails.js';
import aiRoutes from './routes/ai.js';
import activityRoutes from './routes/activity.js';
import { aiProvider } from './services/ai.js';
import { startGmailPolling } from './services/gmail.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, ai: aiProvider() }));
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/activity', activityRoutes);

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
await connectDB();
app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}  |  AI engine: ${aiProvider()}`));
startGmailPolling(Number(process.env.GMAIL_POLL_MS) || 60000);
