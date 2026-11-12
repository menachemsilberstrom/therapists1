import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, inject } from 'vitest';

/**
 * Runs before every test file. Each file gets its own empty database inside the in-memory MongoDB, so test files
 * cannot influence each other.
 */
const baseUri = inject('mongoUri');

// SAFETY NET: these tests create and delete users, so they must never be able to reach a real database.
if (process.env.NODE_ENV !== 'test' || !/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(baseUri)) {
  throw new Error(`Refusing to run the tests: "${baseUri}" is not a local in-memory MongoDB.`);
}
process.env.MONGODB_URI = `${baseUri}test_${randomBytes(4).toString('hex')}`;

beforeAll(async () => {
  // Imported only now, after MONGODB_URI points at the in-memory server (the app reads its settings on import).
  const { connectDB } = await import('../src/config/db.js');
  const database = await connectDB();
  if (!database.startsWith('test_')) throw new Error(`Unexpected database "${database}"`);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
