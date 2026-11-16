// Usage: npm run seed
// Creates (or resets) the demo user and loads the pre-seeded threads.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import ConnectedAccount from '../models/ConnectedAccount.js';
import EmailThread from '../models/EmailThread.js';
import ActivityLog from '../models/ActivityLog.js';
import { connectProvider } from '../services/seeder.js';

const { memory } = await connectDB();
if (memory) console.warn('[seed] In-memory DB is wiped when this process exits. Run the server (which auto-seeds on demo login) instead.');

const old = await User.findOne({ email: 'demo@mailpilot.app' });
if (old) {
  await Promise.all([
    EmailThread.deleteMany({ user: old._id }),
    ConnectedAccount.deleteMany({ user: old._id }),
    ActivityLog.deleteMany({ user: old._id }),
    User.deleteOne({ _id: old._id }),
  ]);
}
const user = await User.create({
  name: 'Sam (Assistant)',
  email: 'demo@mailpilot.app',
  password: await bcrypt.hash('demo1234', 10),
  isDemo: true,
  onboarded: true,
});
await connectProvider(user, 'gmail');
await connectProvider(user, 'outlook');
const n = await EmailThread.countDocuments({ user: user._id });
console.log(`[seed] Done. Demo user demo@mailpilot.app / demo1234 with ${n} threads.`);
await mongoose.disconnect();
process.exit(0);
