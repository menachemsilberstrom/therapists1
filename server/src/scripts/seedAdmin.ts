/**
 * Creates (or updates) the admin account from ADMIN_EMAIL / ADMIN_PASSWORD in server/.env.
 *
 *   npm run seed:admin                # create the admin, or bring an existing admin up to date
 *   npm run seed:admin -- --promote   # also allow turning an existing THERAPIST account into the admin
 *
 * Idempotent: running it again changes nothing unless the role, status or password differ.
 * The password is only ever hashed (bcrypt) and is never printed. Once the admin exists you can
 * delete ADMIN_PASSWORD from .env; the database keeps only the hash.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { connectDB } from '../config/db.js';
import { TherapistProfile } from '../models/TherapistProfile.js';
import { User } from '../models/User.js';

const BCRYPT_COST = 12; // same as normal registration
const PLACEHOLDER_EMAIL = 'admin@example.com';
const PLACEHOLDER_PASSWORD = 'change-this-password';

const inputSchema = z.object({
  ADMIN_EMAIL: z
    .string({ error: 'ADMIN_EMAIL is missing' })
    .trim()
    .toLowerCase()
    .email('ADMIN_EMAIL must be a valid email address'),
  ADMIN_PASSWORD: z
    .string({ error: 'ADMIN_PASSWORD is missing' })
    .min(12, 'ADMIN_PASSWORD must be at least 12 characters (this account can approve and delete users)')
    .max(128, 'ADMIN_PASSWORD must be at most 128 characters'),
});

function readInput(): { email: string; password: string } {
  const parsed = inputSchema.safeParse({
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.message}`).join('\n');
    throw new Error(`Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first:\n${problems}`);
  }
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = parsed.data;
  if (email === PLACEHOLDER_EMAIL || password === PLACEHOLDER_PASSWORD) {
    throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD still contain the placeholder values from .env.example. Choose real ones.');
  }
  return { email, password };
}

async function seedAdmin(): Promise<void> {
  const { email, password } = readInput();
  const allowPromote = process.argv.includes('--promote');

  await connectDB();
  const existing = await User.findOne({ email }).select('+passwordHash');

  if (!existing) {
    await User.create({ email, passwordHash: await bcrypt.hash(password, BCRYPT_COST), role: 'ADMIN', status: 'ACTIVE' });
    console.log(`Admin created: ${email}`);
  } else {
    // Never silently turn a real therapist (who has a public profile) into an admin.
    if (existing.role !== 'ADMIN' && !allowPromote && (await TherapistProfile.exists({ userId: existing._id }))) {
      throw new Error(
        `${email} is an existing therapist account. Re-run with "--promote" to make it the admin ` +
          '(its public profile stays as it is), or choose a different ADMIN_EMAIL.',
      );
    }

    const changes: string[] = [];
    if (existing.role !== 'ADMIN') {
      existing.role = 'ADMIN';
      changes.push('role -> ADMIN');
    }
    if (existing.status !== 'ACTIVE') {
      existing.status = 'ACTIVE';
      changes.push('status -> ACTIVE');
    }
    if (!(await bcrypt.compare(password, existing.passwordHash))) {
      existing.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      changes.push('password updated');
    }

    if (changes.length === 0) {
      console.log(`Admin ${email} is already up to date - nothing to do`);
    } else {
      await existing.save();
      console.log(`Admin ${email} updated: ${changes.join(', ')}`);
    }
  }

  console.log('You can now sign in at /login. Tip: remove ADMIN_PASSWORD from .env once this has run.');
}

seedAdmin()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
