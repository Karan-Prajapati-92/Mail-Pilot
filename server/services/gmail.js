import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import ConnectedAccount from '../models/ConnectedAccount.js';
import EmailThread from '../models/EmailThread.js';
import ActivityLog from '../models/ActivityLog.js';
import { classifyThread } from './ai.js';
import { decrypt } from './crypto.js';

const INITIAL_IMPORT = 25; // newest emails pulled on first connect
const MAX_BODY = 8000;

export const normalizeSubject = (s = '') =>
  s.replace(/^\s*((re|fwd?|fw|aw)\s*:\s*)+/i, '').replace(/\s+/g, ' ').trim().toLowerCase();

const cleanPassword = (p = '') => p.replace(/\s+/g, ''); // Google shows app passwords as "abcd efgh ijkl mnop"

function imapClient(email, password) {
  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: email, pass: cleanPassword(password) },
    logger: false,
    socketTimeout: 30000,
  });
}

function friendlyError(e) {
  const msg = `${e?.responseText || ''} ${e?.message || ''}`;
  if (e?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|Application-specific password/i.test(msg)) {
    return 'Gmail rejected the login. Use a 16-letter App Password (not your normal password), and make sure 2-Step Verification and IMAP are turned on.';
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ECONNRESET|timeout/i.test(msg)) {
    return "Can't reach Gmail (imap.gmail.com). Check the server's internet connection and try again.";
  }
  return `Gmail connection failed: ${e?.message || 'unknown error'}`;
}

/** Throws a user-friendly Error if the credentials don't work. */
export async function verifyGmail(email, password) {
  const c = imapClient(email, password);
  c.on('error', () => {});
  try {
    await c.connect();
    await c.logout();
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

const preview = (html = '') => html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Applies AI classification output onto a thread document. */
async function applyAI(thread) {
  const r = await classifyThread(thread);
  thread.classification = r.classification;
  thread.classificationSource = 'ai';
  thread.confidence = Math.max(0, Math.min(1, Number(r.confidence) || 0.5));
  thread.aiReason = r.reason || '';
  thread.clientReason = r.clientReason || '';
  thread.aiSummary = r.summary || thread.subject;
  thread.aiBullets = Array.isArray(r.bullets) ? r.bullets.map(String).slice(0, 5) : [];
  thread.extractedDates = Array.isArray(r.dates) ? r.dates.map((d) => ({ label: String(d.label || 'Date'), date: String(d.date || '') })) : [];
  thread.waitingForResponse = !!r.waiting;
  if (r.waiting && thread.status === 'open') thread.status = 'waiting';
  thread.actionRequired = !!r.actionRequired;
  thread.isMeeting = !!r.isMeeting;
}

/**
 * Adds one parsed email (mailparser output) to the user's inbox.
 * Groups by normalized subject, skips duplicates, re-runs AI classification.
 * Exported so it can be tested without a live mailbox.
 */
export async function ingestParsed(account, parsed, { seen = false } = {}) {
  const fromAddr = (parsed.from?.value?.[0]?.address || '').toLowerCase();
  const fromName = parsed.from?.value?.[0]?.name || fromAddr || 'Unknown sender';
  const isFromUser = fromAddr === account.email.toLowerCase();
  const subject = (parsed.subject || '(no subject)').trim();
  const key = normalizeSubject(subject);
  const body = ((parsed.text && parsed.text.trim()) || preview(parsed.html || '') || '(no text content)').slice(0, MAX_BODY);
  const sentAt = parsed.date || new Date();
  const messageId = parsed.messageId || '';
  const to = (parsed.to?.value || []).map((a) => a.address).filter(Boolean);

  let thread = await EmailThread.findOne({ user: account.user, account: account._id, threadKey: key });
  if (thread && messageId && thread.messages.some((m) => m.messageId === messageId)) return null; // duplicate

  const msg = { fromName, fromEmail: fromAddr, to, sentAt, body, isFromUser, messageId };
  const known = (list) => list.some((p) => p.email === fromAddr);

  if (!thread) {
    thread = new EmailThread({
      user: account.user,
      account: account._id,
      provider: 'gmail',
      subject: subject.replace(/^\s*((re|fwd?|fw|aw)\s*:\s*)+/i, '').trim() || subject,
      threadKey: key,
      participants: [{ name: fromName, email: fromAddr }],
      messages: [msg],
      lastMessageAt: sentAt,
      isRead: seen || isFromUser,
    });
  } else {
    thread.messages.push(msg);
    thread.messages.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
    if (!known(thread.participants)) thread.participants.push({ name: fromName, email: fromAddr });
    thread.lastMessageAt = thread.messages[thread.messages.length - 1].sentAt;
    if (!seen && !isFromUser) thread.isRead = false;
    if (thread.status === 'completed' || thread.status === 'archived') thread.status = 'open';
    thread.status = thread.status === 'waiting' && !isFromUser ? 'open' : thread.status;
  }

  // New mail from someone else never overwrites a human's manual decision.
  if (thread.isNew || thread.classificationSource === 'ai') await applyAI(thread);
  await thread.save();
  return thread;
}

const running = new Set();

/**
 * Pulls new mail for one real Gmail account. First run imports the newest INITIAL_IMPORT emails;
 * later runs only fetch UIDs greater than the last one seen. Read-only: it never marks mail as read.
 */
export async function syncAccount(accountId) {
  const id = String(accountId);
  if (running.has(id)) return { imported: 0, skipped: true };
  running.add(id);
  let client;
  try {
    const account = await ConnectedAccount.findById(accountId).select('+credentials');
    if (!account || !account.isReal || !account.credentials) return { imported: 0 };

    client = imapClient(account.email, decrypt(account.credentials));
    client.on('error', () => {});
    await client.connect();
    const lock = await client.getMailboxLock('INBOX', { readOnly: true });
    let imported = 0;
    let maxUid = account.lastUid || 0;
    try {
      const total = client.mailbox.exists;
      if (total > 0) {
        const first = !account.lastUid;
        const range = first ? `${Math.max(1, total - INITIAL_IMPORT + 1)}:*` : `${account.lastUid + 1}:*`;
        const batch = [];
        for await (const m of client.fetch(range, { uid: true, source: true, flags: true }, { uid: !first })) {
          if (m.uid > account.lastUid) batch.push(m);
        }
        batch.sort((a, b) => a.uid - b.uid);
        for (const m of batch) {
          try {
            const parsed = await simpleParser(m.source);
            const t = await ingestParsed(account, parsed, { seen: m.flags?.has('\\Seen') });
            if (t) imported++;
          } catch (e) {
            console.warn('[gmail] skipped one message:', e.message);
          }
          maxUid = Math.max(maxUid, m.uid);
        }
      }
    } finally {
      lock.release();
    }

    account.lastUid = maxUid;
    account.lastSyncedAt = new Date();
    account.status = 'connected';
    account.lastError = '';
    account.threadsSynced = await EmailThread.countDocuments({ user: account.user, account: account._id });
    await account.save();
    if (imported > 0) {
      await ActivityLog.create({
        user: account.user,
        actor: 'system',
        action: 'gmail_synced',
        detail: `${imported} new email${imported > 1 ? 's' : ''} imported from Gmail and classified`,
      });
    }
    return { imported };
  } catch (e) {
    const message = friendlyError(e);
    await ConnectedAccount.updateOne({ _id: accountId }, { status: 'disconnected', lastError: message });
    throw new Error(message);
  } finally {
    running.delete(id);
    try { await client?.logout(); } catch { /* already closed */ }
  }
}

/** Background poller: checks every real Gmail account for new mail. */
export function startGmailPolling(intervalMs = 60000) {
  const tick = async () => {
    const accounts = await ConnectedAccount.find({ isReal: true }).select('_id email');
    for (const a of accounts) {
      try {
        const r = await syncAccount(a._id);
        if (r.imported) console.log(`[gmail] ${a.email}: ${r.imported} new`);
      } catch (e) {
        console.warn(`[gmail] ${a.email}: ${e.message}`);
      }
    }
  };
  setInterval(() => tick().catch(() => {}), intervalMs);
}

/** Sends a reply through Gmail SMTP using the connected account. Only called after "Approve & Send". */
export async function sendViaGmail(account, { to, subject, text, inReplyTo }) {
  const full = await ConnectedAccount.findById(account._id).select('+credentials');
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: full.email, pass: cleanPassword(decrypt(full.credentials)) },
  });
  try {
    await transport.sendMail({
      from: `${full.displayName || full.email} <${full.email}>`,
      to,
      subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
      text,
      ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
    });
  } catch (e) {
    throw new Error(/auth|credential|535/i.test(e.message) ? friendlyError({ authenticationFailed: true }) : `Could not send the email: ${e.message}`);
  }
}
