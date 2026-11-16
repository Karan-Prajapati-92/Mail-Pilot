import { Router } from 'express';
import mongoose from 'mongoose';
import EmailThread from '../models/EmailThread.js';
import ActivityLog from '../models/ActivityLog.js';
import { requireAuth } from '../middleware/auth.js';
import { classifyThread, draftReply, askInbox, aiProvider } from '../services/ai.js';

const router = Router();
router.use(requireAuth);

async function getThread(req, res, id) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ message: 'Thread not found' });
    return null;
  }
  const t = await EmailThread.findOne({ _id: id, user: req.user._id });
  if (!t) res.status(404).json({ message: 'Thread not found' });
  return t;
}

router.get('/status', (_req, res) => res.json({ provider: aiProvider() }));

// Re-run AI classification + summary on a thread
router.post('/classify', async (req, res) => {
  const t = await getThread(req, res, req.body.threadId);
  if (!t) return;
  const r = await classifyThread(t);
  t.classification = r.classification;
  t.classificationSource = 'ai';
  t.confidence = Math.max(0, Math.min(1, Number(r.confidence) || 0.5));
  t.aiReason = r.reason || '';
  t.clientReason = r.clientReason || t.clientReason;
  // The heuristic mock engine only re-labels; it never overwrites richer existing
  // summaries/dates. Real LLM output (OpenAI/Gemini) refreshes everything.
  if (r.source !== 'mock' || !t.aiSummary) {
    t.aiSummary = r.summary || t.aiSummary;
    if (Array.isArray(r.bullets) && r.bullets.length) t.aiBullets = r.bullets.map(String).slice(0, 5);
    if (Array.isArray(r.dates)) t.extractedDates = r.dates.map((d) => ({ label: String(d.label || 'Date'), date: String(d.date || '') }));
    t.actionRequired = !!r.actionRequired;
    t.isMeeting = !!r.isMeeting;
  }
  await t.save();
  await ActivityLog.create({
    user: req.user._id,
    thread: t._id,
    actor: 'ai',
    action: 'ai_classified',
    detail: `"${t.subject}" classified as ${t.classification.replace('_', ' ')} (${Math.round(t.confidence * 100)}% via ${r.source})`,
  });
  res.json({ thread: t, source: r.source });
});

// Draft (never sends)
router.post('/draft', async (req, res) => {
  const t = await getThread(req, res, req.body.threadId);
  if (!t) return;
  const r = await draftReply(t, req.body.note || '');
  t.draftReply = r.draft;
  await t.save();
  await ActivityLog.create({ user: req.user._id, thread: t._id, actor: 'ai', action: 'ai_drafted', detail: `AI drafted a reply for "${t.subject}" (awaiting approval)` });
  res.json({ draft: r.draft, source: r.source });
});

// Natural-language inbox Q&A
router.post('/ask', async (req, res) => {
  const { question, threadId } = req.body;
  if (!question?.trim()) return res.status(400).json({ message: 'Ask a question' });
  const threads = await EmailThread.find({ user: req.user._id, status: { $ne: 'archived' } }).sort({ lastMessageAt: -1 }).lean();
  const current = threadId && mongoose.isValidObjectId(threadId) ? threads.find((t) => String(t._id) === threadId) : null;
  const r = await askInbox(question, threads, current);
  const ids = new Set(threads.map((t) => String(t._id)));
  const matched = (r.threadIds || []).map(String).filter((id) => ids.has(id));
  res.json({
    answer: r.answer,
    threads: threads.filter((t) => matched.includes(String(t._id))).map((t) => ({ _id: t._id, subject: t.subject, classification: t.classification })),
    source: r.source,
  });
});

export default router;
