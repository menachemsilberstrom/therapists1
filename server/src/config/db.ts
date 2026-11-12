import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// mongodb+srv:// needs SRV lookups. On some Windows setups Node's resolver defaults to
// 127.0.0.1 (no DNS service there) and fails with ECONNREFUSED, so use public DNS instead.
if (env.MONGODB_URI.startsWith('mongodb+srv://') && dns.getServers().some((s) => s === '127.0.0.1' || s === '::1')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  console.log('MongoDB connected');
}
