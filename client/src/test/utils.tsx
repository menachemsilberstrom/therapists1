import { render } from '@testing-library/react';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TOKEN_KEY } from '../api/client';
import { AuthProvider } from '../context/AuthContext';
import type {
  AdminTherapistDetail,
  AuthUser,
  OwnTherapistProfile,
  TherapistCardData,
} from '../types';

export const therapistUser: AuthUser = { id: 't1', email: 'dana@example.com', role: 'THERAPIST', status: 'ACTIVE' };
export const adminUser: AuthUser = { id: 'a1', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE' };

/** Prints the current URL, so tests can assert where the app navigated to. */
export function LocationProbe() {
  const { pathname, search, state } = useLocation();
  const from = (state as { from?: string } | null)?.from;
  return (
    <div>
      <span data-testid="location">{`${pathname}${search}`}</span>
      {from && <span data-testid="from">{from}</span>}
    </div>
  );
}

interface RenderOptions {
  /** Initial URL, optionally with router state (e.g. the page a login should return to). */
  route?: string | { pathname: string; state?: unknown };
  /** Start logged in as this user (token + user are put into localStorage like a real login does). */
  user?: AuthUser | null;
}

/** Renders inside a router and the real AuthProvider, optionally already logged in. */
export function renderWithProviders(ui: ReactElement, { route = '/', user = null }: RenderOptions = {}) {
  localStorage.clear();
  if (user) {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem('auth_user', JSON.stringify(user));
  }
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}

/** A failed HTTP call as axios reports it, with the given status and JSON body. */
export function httpError(status: number, data: unknown = {}): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, undefined, response);
}

export function makeOwnProfile(overrides: Partial<OwnTherapistProfile> = {}): OwnTherapistProfile {
  return {
    id: 'p1',
    slug: 'dana-123456',
    fullName: 'דנה כהן',
    professionalTitle: 'פסיכולוגית',
    city: 'חיפה',
    region: undefined,
    acceptsOnline: false,
    profileImageUrl: undefined,
    categories: [],
    bio: 'ביו',
    gender: undefined,
    targetAudiences: [],
    contactInfo: { phone: '050-1234567' },
    hasVerifiedCertificates: false,
    isPubliclyVisible: true,
    certificates: [],
    accountStatus: 'ACTIVE',
    ...overrides,
  };
}

export function makeCard(overrides: Partial<TherapistCardData> = {}): TherapistCardData {
  return {
    id: 'c1',
    slug: 'dana-123456',
    fullName: 'דנה כהן',
    professionalTitle: 'פסיכולוגית',
    city: 'חיפה',
    acceptsOnline: false,
    bioSnippet: 'ביו קצר',
    categories: [],
    ...overrides,
  };
}

export function makeAdminDetail(overrides: Partial<AdminTherapistDetail> = {}): AdminTherapistDetail {
  return {
    id: 'u1',
    email: 'dana@example.com',
    accountStatus: 'PENDING_APPROVAL',
    isSeeded: false,
    hasProfile: true,
    fullName: 'דנה כהן',
    professionalTitle: 'פסיכולוגית',
    city: 'חיפה',
    isPubliclyVisible: false,
    certificateCount: 0,
    verifiedCertificateCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    slug: 'dana-123456',
    bio: 'ביו מלא',
    acceptsOnline: false,
    targetAudiences: [],
    categories: [],
    contactInfo: { phone: '050-1234567' },
    certificates: [],
    ...overrides,
  };
}
