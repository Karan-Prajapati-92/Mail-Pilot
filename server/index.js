
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

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ai: aiProvider()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/activity', activityRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.path}`
  });
});

// Error Handler
app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    message: err.message || 'Server error'
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });

    startGmailPolling(
      Number(process.env.GMAIL_POLL_MS) || 60000
    );

  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

startServer();

export default app;