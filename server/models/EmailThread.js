import mongoose from 'mongoose';

export const CLASSIFICATIONS = ['assistant_reply', 'client_reply', 'no_reply', 'needs_review'];
export const STATUSES = ['open', 'waiting', 'completed', 'archived'];

const messageSchema = new mongoose.Schema(
  {
    fromName: String,
    fromEmail: String,
    to: [String],
    sentAt: Date,
    body: String,
    isFromUser: { type: Boolean, default: false },
    messageId: { type: String, default: '' }, // RFC822 Message-ID (real inboxes only)
  },
  { _id: true }
);

const emailThreadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'ConnectedAccount' },
    provider: { type: String, enum: ['gmail', 'outlook'], default: 'gmail' },
    subject: { type: String, required: true },
    threadKey: { type: String, default: '', index: true }, // normalized subject, used to group real emails
    participants: [{ name: String, email: String }],
    messages: [messageSchema],
    lastMessageAt: { type: Date, default: Date.now, index: true },

    // Flags
    isRead: { type: Boolean, default: false },
    isImportant: { type: Boolean, default: false },
    status: { type: String, enum: STATUSES, default: 'open' },

    // AI output
    classification: { type: String, enum: CLASSIFICATIONS, default: 'needs_review' },
    classificationSource: { type: String, enum: ['ai', 'assistant', 'client'], default: 'ai' },
    confidence: { type: Number, default: 0.5 },
    aiSummary: { type: String, default: '' },
    aiBullets: [String],
    aiReason: { type: String, default: '' },
    clientReason: { type: String, default: '' }, // "Why your input is needed"
    actionRequired: { type: Boolean, default: false },
    waitingForResponse: { type: Boolean, default: false },
    isMeeting: { type: Boolean, default: false },
    extractedDates: [{ label: String, date: String }],

    // Client -> assistant handoff
    delegateNote: { type: String, default: '' },
    draftReply: { type: String, default: '' },
  },
  { timestamps: true }
);

emailThreadSchema.index({ subject: 'text', 'messages.body': 'text', aiSummary: 'text' });

export default mongoose.model('EmailThread', emailThreadSchema);
