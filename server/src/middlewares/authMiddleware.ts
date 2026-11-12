import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '../models/User.js';
import { HttpError } from './errorHandler.js';

interface TokenPayload {
  userId: string;
  role: UserRole;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }
  try {
    const decoded = jwt.verify(header.slice(7), env.JWT_SECRET) as TokenPayload;
    req.auth = { userId: decoded.userId, role: decoded.role };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};
