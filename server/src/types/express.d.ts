import type { UserRole, UserStatus } from '../models/User.js';

/** Set by requireAuth from the DATABASE (not from the token), so it is always current. */
export interface AuthPayload {
  userId: string;
  role: UserRole;
  status: UserStatus;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export {};
