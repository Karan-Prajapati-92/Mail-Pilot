import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { connectProvider } from '../services/seeder.js';

const router = Router();

const pub = (u) => ({ id: u._id, name: u.name, email: u.email, onboarded: u.onboarded, isDemo: u.isDemo });

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'An account with this email already exists' });
    const user = await User.create({ name: name.trim(), email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user), user: pub(user) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: pub(user) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// One-click demo: ensures a ready-to-go demo user with both inboxes connected.
router.post('/demo', async (_req, res) => {
  try {
    let user = await User.findOne({ email: 'demo@mailpilot.app' });
    if (!user) {
      user = await User.create({
        name: 'Sam (Assistant)',
        email: 'demo@mailpilot.app',
        password: await bcrypt.hash('demo1234', 10),
        isDemo: true,
        onboarded: true,
      });
    }
    await connectProvider(user, 'gmail');
    await connectProvider(user, 'outlook');
    if (!user.onboarded) {
      user.onboarded = true;
      await user.save();
    }
    res.json({ token: signToken(user), user: pub(user) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: pub(req.user) }));

router.post('/onboarded', requireAuth, async (req, res) => {
  req.user.onboarded = true;
  await req.user.save();
  res.json({ user: pub(req.user) });
});

export default router;
