import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    thread: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailThread' },
    actor: { type: String, enum: ['assistant', 'client', 'ai', 'system'], default: 'assistant' },
    action: { type: String, required: true },
    detail: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('ActivityLog', activityLogSchema);
