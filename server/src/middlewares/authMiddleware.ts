import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { HttpError } from './errorHandler.js';

interface TokenPayload {
  userId: string;
}

/**
 * Verifies the JWT, then loads the account so that role and status come from the DATABASE, not from the token.
 * That makes a suspension (or a role change) take effect on the very next request instead of when the token expires.
 * PENDING_APPROVAL accounts are allowed: therapists can edit their profile while waiting for approval.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required');

  let userId: string;
  try {
    userId = (jwt.verify(header.slice(7), env.JWT_SECRET) as TokenPayload).userId;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const user = await User.findById(userId, 'role status').lean();
  if (!user) throw new HttpError(401, 'Invalid or expired token');
  if (user.status === 'SUSPENDED') throw new HttpError(403, 'Account suspended');

  req.auth = { userId, role: user.role };
  req.log.setBindings({ userId }); // every later log line of this request carries the user id
  next();
};
