import mongoose from 'mongoose';

const connectedAccountSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['gmail', 'outlook'], required: true },
    email: { type: String, required: true },
    displayName: { type: String },
    status: { type: String, enum: ['connected', 'syncing', 'disconnected'], default: 'connected' },
    lastSyncedAt: { type: Date, default: Date.now },
    threadsSynced: { type: Number, default: 0 },

    // Real inbox connection (Gmail over IMAP with an app password)
    isReal: { type: Boolean, default: false },
    credentials: { type: String, select: false }, // encrypted app password, never returned by the API
    lastUid: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
  },
  { timestamps: true }
);

connectedAccountSchema.index({ user: 1, provider: 1 }, { unique: true });

export default mongoose.model('ConnectedAccount', connectedAccountSchema);
