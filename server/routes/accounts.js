import { Router } from 'express';
import ConnectedAccount from '../models/ConnectedAccount.js';
import EmailThread from '../models/EmailThread.js';
import ActivityLog from '../models/ActivityLog.js';
import { requireAuth } from '../middleware/auth.js';
import { connectProvider } from '../services/seeder.js';
import { encrypt } from '../services/crypto.js';
import { syncAccount, verifyGmail } from '../services/gmail.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const accounts = await ConnectedAccount.find({ user: req.user._id }).sort({ createdAt: 1 });
  res.json({ accounts });
});

// Simulated OAuth (sample data): the client shows a consent screen, then calls this endpoint.
router.post('/connect', async (req, res) => {
  const { provider } = req.body;
  if (!['gmail', 'outlook'].includes(provider)) return res.status(400).json({ message: 'Unknown provider' });
  const existing = await ConnectedAccount.findOne({ user: req.user._id, provider });
  if (existing?.isReal) return res.status(409).json({ message: 'A real Gmail inbox is already connected. Disconnect it first to load sample data.' });
  const account = await connectProvider(req.user, provider);
  res.status(201).json({ account });
});

// Real Gmail over IMAP with an app password.
router.post('/connect-gmail', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const appPassword = (req.body.appPassword || '').replace(/\s+/g, '');
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter your full Gmail address' });
  if (appPassword.length !== 16) return res.status(400).json({ message: 'An App Password has 16 letters. Copy it exactly as Google shows it.' });

  try {
    await verifyGmail(email, appPassword);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }

  // Replace any sample Gmail data this user loaded earlier.
  const old = await ConnectedAccount.findOne({ user: req.user._id, provider: 'gmail' });
  if (old) {
    await EmailThread.deleteMany({ user: req.user._id, account: old._id });
    await ConnectedAccount.deleteOne({ _id: old._id });
  }
  const account = await ConnectedAccount.create({
    user: req.user._id,
    provider: 'gmail',
    email,
    displayName: req.user.name,
    status: 'connected',
    isReal: true,
    credentials: encrypt(appPassword),
  });
  await ActivityLog.create({ user: req.user._id, actor: 'system', action: 'account_connected', detail: `Gmail (${email}) connected` });

  try {
    const r = await syncAccount(account._id);
    const fresh = await ConnectedAccount.findById(account._id);
    res.status(201).json({ account: fresh, imported: r.imported });
  } catch (e) {
    res.status(502).json({ message: e.message });
  }
});

router.post('/:id/sync', async (req, res) => {
  const account = await ConnectedAccount.findOne({ _id: req.params.id, user: req.user._id });
  if (!account) return res.status(404).json({ message: 'Account not found' });
  let imported = 0;
  if (account.isReal) {
    try {
      imported = (await syncAccount(account._id)).imported;
    } catch (e) {
      return res.status(502).json({ message: e.message });
    }
  } else {
    account.lastSyncedAt = new Date();
    account.status = 'connected';
    await account.save();
  }
  res.json({ account: await ConnectedAccount.findById(account._id), imported });
});

router.delete('/:id', async (req, res) => {
  const account = await ConnectedAccount.findOne({ _id: req.params.id, user: req.user._id });
  if (!account) return res.status(404).json({ message: 'Account not found' });
  const { deletedCount } = await EmailThread.deleteMany({ user: req.user._id, account: account._id });
  await ConnectedAccount.deleteOne({ _id: account._id });
  await ActivityLog.create({ user: req.user._id, actor: 'system', action: 'account_disconnected', detail: `${account.email} disconnected, ${deletedCount} threads removed from Mailpilot` });
  res.json({ ok: true, removedThreads: deletedCount });
});

export default router;
