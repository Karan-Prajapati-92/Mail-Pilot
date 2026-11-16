import { Router } from 'express';
import mongoose from 'mongoose';
import EmailThread, { CLASSIFICATIONS } from '../models/EmailThread.js';
import ActivityLog from '../models/ActivityLog.js';
import ConnectedAccount from '../models/ConnectedAccount.js';
import { sendViaGmail } from '../services/gmail.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const LIVE = { status: { $nin: ['archived'] } };
const OPEN = { status: { $in: ['open'] } };
const NOT_WAITING = { waitingForResponse: { $ne: true } };

/** Shared filter definitions used by the sidebar, KPI strip and Ask-AI. */
export function filterQuery(filter) {
  switch (filter) {
    case 'assistant_reply':
      return { ...OPEN, ...NOT_WAITING, classification: 'assistant_reply' };
    case 'client_reply':
      return { ...OPEN, classification: 'client_reply' };
    case 'no_reply':
      return { ...LIVE, classification: 'no_reply' };
    case 'needs_review':
      return { ...OPEN, classification: 'needs_review' };
    case 'action_required':
      return { ...OPEN, actionRequired: true };
    case 'waiting':
      return { status: { $in: ['open', 'waiting'] }, $or: [{ waitingForResponse: true }, { status: 'waiting' }] };
    case 'meetings':
      return { ...LIVE, status: { $nin: ['archived', 'completed'] }, isMeeting: true };
    case 'important':
      return { ...LIVE, isImportant: true };
    case 'unread':
      return { ...LIVE, isRead: false };
    case 'archived':
      return { status: 'archived' };
    default:
      return { ...LIVE };
  }
}

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function log(req, thread, action, detail, actor = 'assistant') {
  await ActivityLog.create({ user: req.user._id, thread: thread?._id, actor, action, detail });
}

const validId = (id) => mongoose.isValidObjectId(id);

// List with filter + search
router.get('/', async (req, res) => {
  const { filter = 'all', q = '' } = req.query;
  const query = { user: req.user._id, ...filterQuery(filter) };
  if (q.trim()) {
    const rx = new RegExp(escapeRx(q.trim()), 'i');
    const search = [{ subject: rx }, { aiSummary: rx }, { 'messages.body': rx }, { 'participants.name': rx }, { 'participants.email': rx }];
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: search }];
      delete query.$or;
    } else query.$or = search;
  }
  const threads = await EmailThread.find(query).sort({ lastMessageAt: -1 }).lean();
  res.json({ threads });
});

// KPI + sidebar counts
router.get('/stats', async (req, res) => {
  const keys = ['all', 'unread', 'assistant_reply', 'client_reply', 'no_reply', 'needs_review', 'action_required', 'waiting', 'meetings', 'important'];
  const counts = {};
  await Promise.all(
    keys.map(async (k) => {
      counts[k] = await EmailThread.countDocuments({ user: req.user._id, ...filterQuery(k) });
    })
  );
  res.json({ counts });
});

router.get('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Thread not found' });
  const thread = await EmailThread.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!thread) return res.status(404).json({ message: 'Thread not found' });
  res.json({ thread });
});

// Generic update: flags, status, manual classification override
router.patch('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Thread not found' });
  const thread = await EmailThread.findOne({ _id: req.params.id, user: req.user._id });
  if (!thread) return res.status(404).json({ message: 'Thread not found' });

  const { isRead, isImportant, status, classification, draftReply } = req.body;
  const notes = [];

  if (typeof isRead === 'boolean') thread.isRead = isRead;
  if (typeof isImportant === 'boolean') {
    thread.isImportant = isImportant;
    notes.push(isImportant ? 'marked important' : 'removed important');
  }
  if (typeof draftReply === 'string') thread.draftReply = draftReply;
  if (status) {
    if (!['open', 'waiting', 'completed', 'archived'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    thread.status = status;
    if (status !== 'waiting') thread.waitingForResponse = false;
    if (status === 'completed') thread.actionRequired = false;
    notes.push(`status → ${status}`);
  }
  if (classification) {
    if (!CLASSIFICATIONS.includes(classification)) return res.status(400).json({ message: 'Invalid classification' });
    if (classification !== thread.classification) {
      const from = thread.classification;
      thread.classification = classification;
      thread.classificationSource = 'assistant';
      thread.confidence = 1;
      thread.aiReason = `Manually set by the assistant (was ${from.replace('_', ' ')}).`;
      if (classification === 'client_reply' && !thread.clientReason) thread.clientReason = 'The assistant flagged this for your personal attention.';
      if (classification === 'no_reply') thread.actionRequired = false;
      notes.push(`classification ${from} → ${classification}`);
    }
  }
  await thread.save();
  if (notes.length) await log(req, thread, 'thread_updated', `"${thread.subject}": ${notes.join(', ')}`);
  res.json({ thread });
});

// Human-in-the-loop send: only happens when the user clicks Approve & Send.
router.post('/:id/send', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Thread not found' });
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ message: 'Reply cannot be empty' });
  const thread = await EmailThread.findOne({ _id: req.params.id, user: req.user._id });
  if (!thread) return res.status(404).json({ message: 'Thread not found' });

  const recipient = [...thread.messages].reverse().find((m) => !m.isFromUser);
  const account = thread.account ? await ConnectedAccount.findById(thread.account) : null;

  // Real Gmail account: actually send through Gmail SMTP. Sample data: just record the reply.
  if (account?.isReal) {
    if (!recipient?.fromEmail) return res.status(400).json({ message: 'No recipient found for this thread' });
    try {
      await sendViaGmail(account, { to: recipient.fromEmail, subject: thread.subject, text: body.trim(), inReplyTo: recipient.messageId });
    } catch (e) {
      return res.status(502).json({ message: e.message });
    }
  }
  thread.messages.push({
    fromName: account?.displayName || 'Alex Rivera',
    fromEmail: account?.email || 'alex.founder@company.com',
    to: recipient ? [recipient.fromEmail] : [],
    sentAt: new Date(),
    body: body.trim(),
    isFromUser: true,
  });
  thread.lastMessageAt = new Date();
  thread.draftReply = '';
  thread.isRead = true;
  thread.status = 'waiting';
  thread.waitingForResponse = true;
  thread.actionRequired = false;
  await thread.save();
  await log(req, thread, 'reply_sent', `Reply approved & sent on "${thread.subject}"`);
  res.json({ thread });
});

// Client portal actions (two-way sync)
router.post('/:id/client-action', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Thread not found' });
  const { action, note = '' } = req.body;
  const thread = await EmailThread.findOne({ _id: req.params.id, user: req.user._id });
  if (!thread) return res.status(404).json({ message: 'Thread not found' });

  if (action === 'handled') {
    thread.classification = 'no_reply';
    thread.classificationSource = 'client';
    thread.status = 'completed';
    thread.actionRequired = false;
    thread.isRead = true;
    thread.aiReason = 'Client marked this as handled.';
    await thread.save();
    await log(req, thread, 'client_handled', `Client marked "${thread.subject}" as handled`, 'client');
  } else if (action === 'delegate') {
    thread.classification = 'assistant_reply';
    thread.classificationSource = 'client';
    thread.status = 'open';
    thread.actionRequired = true;
    thread.delegateNote = note.trim();
    thread.isRead = false;
    thread.aiReason = `Client delegated this to the assistant${note.trim() ? `: "${note.trim()}"` : '.'}`;
    await thread.save();
    await log(req, thread, 'client_delegated', `Client delegated "${thread.subject}" to assistant${note.trim() ? ` with note: ${note.trim()}` : ''}`, 'client');
  } else {
    return res.status(400).json({ message: 'Unknown action' });
  }
  res.json({ thread });
});

export default router;
