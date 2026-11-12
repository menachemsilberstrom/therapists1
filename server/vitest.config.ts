import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Uploaded files created by the tests live in a throw-away folder in the OS temp directory (removed afterwards).
export const TEST_UPLOADS_DIR = path.join(os.tmpdir(), 'therapists-directory-tests', 'uploads');

export default defineConfig({
  test: {
    environment: 'node',
    // Separate worker PROCESSES (the default). On some Windows machines Node occasionally aborts one of them mid-run;
    // tests/run.mjs then re-runs just that file (a few seconds). With thread workers a crash would take the whole run
    // down and everything would have to be repeated, which costs far more time on average.
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'], // starts ONE in-memory MongoDB for the whole run
    setupFiles: ['tests/setup.ts'], //        gives every test file its own database inside it
    fileParallelism: false, //                files run one after another (shared uploads folder, simple and deterministic)
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // Environment for the app under test. MONGODB_URI is a placeholder: tests/setup.ts replaces it with the in-memory
    // server's address and refuses to run if it is not a local one, so the tests can never reach a real database.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      JWT_SECRET: 'test-only-secret-that-is-long-enough',
      BCRYPT_ROUNDS: '4',
      CLIENT_ORIGIN: 'http://localhost:5173',
      MONGODB_URI: 'mongodb://127.0.0.1:1/placeholder-never-used',
      UPLOADS_DIR: TEST_UPLOADS_DIR,
    },
  },
});
