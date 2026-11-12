import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
// Strict in production; relaxed locally so repeated manual testing (requests.http) doesn't lock you out.
const AUTH_FAILURE_LIMIT = env.NODE_ENV === 'production' ? 20 : 200;

/** Generous limit for the whole API: stops runaway scripts without bothering real visitors. */
export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
});

/** Uploads are the most expensive requests (image processing, disk), so they get their own tighter limit. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many uploads, please try again later' },
});

/**
 * Strict limit on login/register against password guessing.
 * Only FAILED attempts count (wrong password, duplicate email, validation errors),
 * so normal successful logins are never blocked.
 */
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: AUTH_FAILURE_LIMIT,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many failed attempts, please try again in a few minutes' },
});
