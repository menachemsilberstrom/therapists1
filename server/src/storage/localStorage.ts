import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { StorageAccess, StorageProvider } from './types.js';

const PUBLIC_URL_PREFIX = '/uploads/';
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

/** Stores files on the server's disk: <root>/public (served at /uploads) and <root>/private (never served). */
export class LocalStorage implements StorageProvider {
  readonly publicDir: string;
  private readonly privateDir: string;

  constructor(root: string) {
    this.publicDir = path.join(root, 'public');
    this.privateDir = path.join(root, 'private');
  }

  /** Maps a key to a path and refuses anything that could escape the storage folder. */
  private resolve(access: StorageAccess, key: string): string {
    const base = access === 'public' ? this.publicDir : this.privateDir;
    const full = path.resolve(base, key);
    if (!SAFE_KEY.test(key) || key.includes('..') || !full.startsWith(base + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async save(access: StorageAccess, key: string, data: Buffer): Promise<void> {
    const full = this.resolve(access, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: 'wx' }); // "wx": fail instead of overwriting
  }

  publicUrl(key: string): string {
    return `${PUBLIC_URL_PREFIX}${key}`;
  }

  keyFromPublicUrl(url: string): string | null {
    return url.startsWith(PUBLIC_URL_PREFIX) ? url.slice(PUBLIC_URL_PREFIX.length) : null;
  }

  async openPrivate(key: string): Promise<Readable | null> {
    const full = this.resolve('private', key);
    try {
      await stat(full);
    } catch {
      return null;
    }
    return createReadStream(full);
  }

  async remove(access: StorageAccess, key: string): Promise<void> {
    await rm(this.resolve(access, key), { force: true });
  }
}
