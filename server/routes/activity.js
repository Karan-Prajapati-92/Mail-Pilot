import { Router } from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const logs = await ActivityLog.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).lean();
  res.json({ logs });
});

export default router;
