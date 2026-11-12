import dns from 'node:dns';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { TherapistProfile } from '../models/TherapistProfile.js';
import { User } from '../models/User.js';
import { env } from './env.js';

// mongodb+srv:// needs SRV lookups. On some Windows setups Node's resolver defaults to
// 127.0.0.1 (no DNS service there) and fails with ECONNREFUSED, so use public DNS instead.
if (env.MONGODB_URI.startsWith('mongodb+srv://') && dns.getServers().some((s) => s === '127.0.0.1' || s === '::1')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

/** Connects, makes sure our indexes exist, and returns the name of the database that was selected. */
export async function connectDB(): Promise<string> {
  await mongoose.connect(env.MONGODB_URI);
  try {
    // init() only creates MISSING indexes (it never drops anything), so it is safe on any database.
    await Promise.all([User.init(), Category.init(), TherapistProfile.init()]);
  } catch (err) {
    console.warn('Warning: some database indexes could not be created:', err instanceof Error ? err.message : err);
  }
  return mongoose.connection.name;
}
