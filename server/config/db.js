import mongoose from 'mongoose';

/**
 * Connects to MONGO_URI. If MongoDB isn't reachable and `mongodb-memory-server`
 * is installed (dev dependency), spins up an in-memory instance so the demo
 * "just works" for evaluators without a local MongoDB.
 */
export async function connectDB() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
    console.log(`[db] connected to ${uri}`);
    return { memory: false };
  } catch (err) {
    console.warn(`[db] could not reach ${uri} (${err.message}). Trying in-memory MongoDB...`);
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mem = await MongoMemoryServer.create();
      await mongoose.connect(mem.getUri('mailpilot'));
      console.log('[db] using in-memory MongoDB (data resets on restart)');
      return { memory: true };
    } catch (e) {
      console.error('[db] No MongoDB available. Start MongoDB or set MONGO_URI.', e.message);
      process.exit(1);
    }
  }
}
