import type { Readable } from 'node:stream';

/** public: anyone with the URL can fetch it (avatars). private: only reachable through authenticated endpoints (certificates). */
export type StorageAccess = 'public' | 'private';

/**
 * Where uploaded files live. Controllers only talk to this interface, so moving from local disk to a
 * cloud provider (Cloudinary, S3, ...) means writing one new class, with no change to routes or controllers.
 */
export interface StorageProvider {
  /** Stores the bytes under `key`. Must never overwrite an existing file. */
  save(access: StorageAccess, key: string, data: Buffer): Promise<void>;
  /** URL to put in a page for a PUBLIC file. */
  publicUrl(key: string): string;
  /** Inverse of publicUrl(): the key of a URL this provider produced, or null for anything else. */
  keyFromPublicUrl(url: string): string | null;
  /** Streams a PRIVATE file (for an authenticated download endpoint); null if it doesn't exist. */
  openPrivate(key: string): Promise<Readable | null>;
  /** Deletes a file; deleting something that doesn't exist is not an error. */
  remove(access: StorageAccess, key: string): Promise<void>;
}
