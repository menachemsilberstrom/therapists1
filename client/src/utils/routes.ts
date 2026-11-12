import type { UserRole } from '../types';

/** Where a signed-in user lands by default: admins manage the site, therapists edit their profile. */
export const homePathFor = (role: UserRole): string => (role === 'ADMIN' ? '/admin' : '/dashboard');
