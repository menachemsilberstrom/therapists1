import type { RequestHandler } from 'express';
import type { UserRole } from '../models/User.js';
import { HttpError } from './errorHandler.js';

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      next(new HttpError(403, 'Forbidden'));
      return;
    }
    next();
  };
