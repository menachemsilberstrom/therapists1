import { readdirSync, existsSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Category } from '../src/models/Category.js';
import { TherapistProfile, type ITherapistProfile } from '../src/models/TherapistProfile.js';
import { User, type UserStatus } from '../src/models/User.js';

/** One app per test file (every file has its own module registry, so rate-limit counters are not shared either). */
export const app = createApp();
export const api = () => request(app);

export const bearer = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` });

/** A valid login token for a user that was created directly in the database. */
export const tokenFor = (userId: string, expiresIn: jwt.SignOptions['expiresIn'] = '1h'): string =>
  jwt.sign({ userId }, env.JWT_SECRET, { expiresIn });

let counter = 0;
export const uniq = (): string => `${Date.now().toString(36)}${(counter += 1).toString(36)}`;

/** Empties every collection (indexes are kept). */
export async function resetDb(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Not connected');
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function createCategory(slug: string, name: string = slug, isActive = true) {
  return Category.create({ slug, name, isActive });
}

export interface TherapistOptions {
  email?: string;
  password?: string;
  status?: UserStatus;
  /** Defaults to true when the account is ACTIVE. */
  visible?: boolean;
  /** false = an account without any profile document. */
  withProfile?: boolean;
  fullName?: string;
  /** Category slugs (the categories must already exist). */
  categories?: string[];
  profile?: Partial<Pick<ITherapistProfile, 'professionalTitle' | 'gender' | 'bio' | 'city' | 'region' | 'acceptsOnline' | 'targetAudiences' | 'contactInfo'>>;
}

export interface TherapistFixture {
  userId: string;
  email: string;
  password: string;
  token: string;
  profileId?: string;
  slug?: string;
}

/**
 * Creates a therapist straight in the database (fast, no HTTP). By default the therapist is ACTIVE and publicly
 * visible, so it shows up in the directory; pass status / visible / withProfile to model the other situations.
 */
export async function createTherapist(options: TherapistOptions = {}): Promise<TherapistFixture> {
  const id = uniq();
  const email = options.email ?? `therapist-${id}@example.com`;
  const password = options.password ?? 'Therapist-pass-123';
  const status = options.status ?? 'ACTIVE';

  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
    role: 'THERAPIST',
    status,
  });
  const fixture: TherapistFixture = { userId: user.id as string, email, password, token: tokenFor(user.id as string) };
  if (options.withProfile === false) return fixture;

  const fullName = options.fullName ?? `מטפל ${id}`;
  const categoryDocs = options.categories?.length ? await Category.find({ slug: { $in: options.categories } }, '_id') : [];
  const profile = await TherapistProfile.create({
    userId: user._id,
    slug: `${fullName.replace(/[^\p{L}\p{N}]+/gu, '-')}-${id}`,
    fullName,
    categories: categoryDocs.map((c) => c._id),
    isPubliclyVisible: options.visible ?? status === 'ACTIVE',
    ...options.profile,
  });
  return { ...fixture, profileId: profile.id as string, slug: profile.slug };
}

export const ADMIN_PASSWORD = 'Admin-pass-12345';

export async function createAdmin(email = `admin-${uniq()}@example.com`): Promise<{ userId: string; email: string; password: string; token: string }> {
  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, env.BCRYPT_ROUNDS),
    role: 'ADMIN',
    status: 'ACTIVE',
  });
  return { userId: user.id as string, email, password: ADMIN_PASSWORD, token: tokenFor(user.id as string) };
}

/** Registers a therapist through the real endpoint (so the whole registration flow is exercised). */
export async function registerTherapist(fullName = `נרשם ${uniq()}`, email = `reg-${uniq()}@example.com`) {
  const password = 'Register-pass-123';
  const res = await api().post('/api/auth/register').send({ email, password, fullName });
  return { res, email, password, token: res.body.token as string, userId: res.body.user?.id as string };
}

// ---------------------------------------------------------------------------------------------------------------
// Fixture files for the upload tests
// ---------------------------------------------------------------------------------------------------------------

// sharp is loaded on demand so that test files that never touch images don't load the native library at all.
const loadSharp = async () => (await import('sharp')).default;

export const pngBuffer = async (width = 300, height = 200): Promise<Buffer> =>
  (await loadSharp())({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } } }).png().toBuffer();

/** A JPEG that really contains EXIF metadata (used to prove the server strips it). */
export const jpegWithExif = async (): Promise<Buffer> =>
  (await loadSharp())({ create: { width: 1200, height: 800, channels: 3, background: { r: 200, g: 60, b: 60 } } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'SECRET-EXIF-MARKER' } })
    .toBuffer();

export const pdfBuffer = (): Buffer => Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

/** Number of files (not folders) below the uploads folder used by the tests. */
export function uploadedFileCount(): number {
  const dir = process.env.UPLOADS_DIR;
  if (!dir || !existsSync(dir)) return 0;
  return readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length;
}
