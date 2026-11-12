import { rm } from 'node:fs/promises';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';
import { TEST_UPLOADS_DIR } from '../vitest.config.js';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Address of the in-memory MongoDB started for this test run. */
    mongoUri: string;
  }
}

/**
 * Runs once before all test files: starts a MongoDB that lives only in memory (nothing is written to disk, nothing is
 * reachable from outside this machine) and hands its address to the test files. The first run on a new machine
 * downloads the MongoDB binary once (about 75 MB); later runs start in about a second.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  await rm(TEST_UPLOADS_DIR, { recursive: true, force: true });
  // The test data is tiny, but MongoDB sizes its cache at half of the machine's RAM by default. Capping it keeps the
  // test run light, which matters on busy machines: a Node worker that runs out of memory is aborted by the OS.
  const mongod = await MongoMemoryServer.create({ instance: { args: ['--wiredTigerCacheSizeGB', '0.25'] } });
  project.provide('mongoUri', mongod.getUri());

  return async () => {
    await mongod.stop();
    await rm(TEST_UPLOADS_DIR, { recursive: true, force: true });
  };
}
