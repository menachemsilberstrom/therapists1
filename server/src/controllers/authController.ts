import type { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User, type UserDocument } from '../models/User.js';
import { TherapistProfile } from '../models/TherapistProfile.js';
import { HttpError } from '../middlewares/errorHandler.js';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const registerSchema = credentialsSchema.extend({
  fullName: z.string().trim().max(100).optional(),
});

function signToken(user: UserDocument): string {
  return jwt.sign({ userId: user.id as string, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function publicUser(user: UserDocument) {
  return { id: user.id as string, email: user.email, role: user.role, status: user.status };
}

function makeSlug(base: string): string {
  const cleaned = base
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `${cleaned || 'therapist'}-${randomBytes(3).toString('hex')}`;
}

export const register: RequestHandler = async (req, res) => {
  const { email, password, fullName } = registerSchema.parse(req.body);

  if (await User.exists({ email: email.toLowerCase() })) {
    throw new HttpError(409, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // POC: new users are ACTIVE so results appear immediately (becomes PENDING_APPROVAL in Step 2.2)
  const user = await User.create({ email, passwordHash, role: 'THERAPIST', status: 'ACTIVE' });

  await TherapistProfile.create({
    userId: user._id,
    slug: makeSlug(fullName ?? email.split('@')[0] ?? 'therapist'),
    fullName: fullName ?? '',
    isPubliclyVisible: true,
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) throw new HttpError(401, 'Invalid email or password');
  if (user.status === 'SUSPENDED') throw new HttpError(403, 'Account suspended');

  res.json({ token: signToken(user), user: publicUser(user) });
};
