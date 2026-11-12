import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalStorage } from '../../src/storage/localStorage.js';

let root: string;
let storage: LocalStorage;

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
  storage = new LocalStorage(root);
});
afterAll(() => rm(root, { recursive: true, force: true }));

describe('LocalStorage', () => {
  it('saves a file and reads it back from the private area as a stream', async () => {
    await storage.save('private', 'certificates/a/file.pdf', Buffer.from('%PDF-secret'));
    const stream = await storage.openPrivate('certificates/a/file.pdf');
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toBe('%PDF-secret');
  });

  it('keeps public and private files in different folders', async () => {
    await storage.save('public', 'avatars/p.webp', Buffer.from('img'));
    expect((await readFile(path.join(root, 'public', 'avatars', 'p.webp'))).toString()).toBe('img');
    expect(await storage.openPrivate('avatars/p.webp')).toBeNull(); // not in the private area
  });

  it('never overwrites an existing file', async () => {
    await storage.save('private', 'once.bin', Buffer.from('first'));
    await expect(storage.save('private', 'once.bin', Buffer.from('second'))).rejects.toThrow();
    expect((await readFile(path.join(root, 'private', 'once.bin'))).toString()).toBe('first');
  });

  it.each(['../escape.txt', '/etc/passwd', 'a/../../escape.txt', '..', 'a/./b/../../../x', 'C:\\windows\\x', '', ' leading-space', 'weird name.txt'])(
    'refuses the unsafe key %j (path traversal)',
    async (key) => {
      await expect(storage.save('public', key, Buffer.from('x'))).rejects.toThrow('Invalid storage key');
      await expect(storage.openPrivate(key)).rejects.toThrow('Invalid storage key');
      await expect(storage.remove('private', key)).rejects.toThrow('Invalid storage key');
    },
  );

  it('answers null for a private file that does not exist', async () => {
    expect(await storage.openPrivate('certificates/none/missing.pdf')).toBeNull();
  });

  it('removing a file twice, or a file that never existed, is not an error', async () => {
    await storage.save('public', 'avatars/gone.webp', Buffer.from('x'));
    await storage.remove('public', 'avatars/gone.webp');
    await expect(storage.remove('public', 'avatars/gone.webp')).resolves.toBeUndefined();
  });

  it('maps keys to public URLs and back, and recognises foreign URLs', () => {
    expect(storage.publicUrl('avatars/x.webp')).toBe('/uploads/avatars/x.webp');
    expect(storage.keyFromPublicUrl('/uploads/avatars/x.webp')).toBe('avatars/x.webp');
    expect(storage.keyFromPublicUrl('https://evil.example/uploads/avatars/x.webp')).toBeNull();
    expect(storage.keyFromPublicUrl('/other/x.webp')).toBeNull();
  });
});
