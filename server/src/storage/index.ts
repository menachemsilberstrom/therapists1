import path from 'node:path';
import { env } from '../config/env.js';
import { LocalStorage } from './localStorage.js';
import type { StorageProvider } from './types.js';

const local = new LocalStorage(path.resolve(process.cwd(), env.UPLOADS_DIR));

/** The active storage provider. To move to the cloud, build another StorageProvider here based on env. */
export const storage: StorageProvider = local;

/** Folder served at /uploads. Only meaningful for the local provider (a cloud provider serves its own URLs). */
export const publicUploadsDir = local.publicDir;
