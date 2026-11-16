import EmailThread from '../models/EmailThread.js';
import ConnectedAccount from '../models/ConnectedAccount.js';
import ActivityLog from '../models/ActivityLog.js';
import { seedThreads } from '../data/threads.js';

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

/** Inserts the pre-seeded threads for one provider into a user's inbox. */
export async function seedThreadsForProvider(user, account) {
  const existing = await EmailThread.countDocuments({ user: user._id, account: account._id });
  if (existing > 0) return existing;

  const docs = seedThreads
    .filter((t) => t.provider === account.provider)
    .map((t) => {
      const messages = t.messages.map((m) => ({
        fromName: m.from.name,
        fromEmail: m.from.email,
        to: [],
        sentAt: hoursAgo(m.ago),
        body: m.body,
        isFromUser: !!m.isFromUser,
      }));
      return {
        user: user._id,
        account: account._id,
        provider: t.provider,
        subject: t.subject,
        participants: t.participants,
        messages,
        lastMessageAt: messages[messages.length - 1].sentAt,
        isRead: !t.unread,
        isImportant: !!t.important,
        status: t.status,
        classification: t.classification,
        classificationSource: 'ai',
        confidence: t.confidence,
        aiSummary: t.summary,
        aiBullets: t.bullets,
        aiReason: t.reason,
        clientReason: t.clientReason,
        actionRequired: !!t.actionRequired,
        waitingForResponse: !!t.waiting,
        isMeeting: !!t.meeting,
        extractedDates: t.dates,
      };
    });

  await EmailThread.insertMany(docs);
  account.threadsSynced = docs.length;
  account.lastSyncedAt = new Date();
  account.status = 'connected';
  await account.save();
  await ActivityLog.create({
    user: user._id,
    actor: 'system',
    action: 'account_connected',
    detail: `${account.provider === 'gmail' ? 'Gmail' : 'Outlook'} connected, ${docs.length} threads synced and classified`,
  });
  return docs.length;
}

export async function connectProvider(user, provider) {
  const email = provider === 'gmail' ? 'alex.founder@company.com' : 'alex.rivera@company.onmicrosoft.com';
  let account = await ConnectedAccount.findOne({ user: user._id, provider });
  if (!account) {
    account = await ConnectedAccount.create({
      user: user._id,
      provider,
      email,
      displayName: 'Alex Rivera',
      status: 'connected',
    });
  }
  await seedThreadsForProvider(user, account);
  return account;
}
