import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, AUTH_EXPIRED_EVENT, TOKEN_KEY } from './client';

let lastRequest: InternalAxiosRequestConfig | undefined;
let expiredEvents = 0;
const onExpired = () => {
  expiredEvents += 1;
};

/** Makes the next request answer with the given status and body, without touching the network. */
function answerWith(status: number, data: unknown = {}) {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    lastRequest = config;
    const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) throw new AxiosError(`status ${status}`, 'ERR_BAD_REQUEST', config, undefined, response);
    return response;
  };
}

beforeEach(() => {
  lastRequest = undefined;
  expiredEvents = 0;
  window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
});
afterEach(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  vi.restoreAllMocks();
});

describe('request interceptor', () => {
  it('sends the saved login token as a Bearer header', async () => {
    localStorage.setItem(TOKEN_KEY, 'abc.def.ghi');
    answerWith(200);
    await api.get('/anything');
    expect(lastRequest?.headers.get('Authorization')).toBe('Bearer abc.def.ghi');
  });

  it('sends no Authorization header when nobody is logged in', async () => {
    answerWith(200);
    await api.get('/anything');
    expect(lastRequest?.headers.get('Authorization')).toBeFalsy();
  });

  it('keeps working when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    answerWith(200);
    await expect(api.get('/anything')).resolves.toBeDefined();
  });

  it('talks to the API under /api (proxied to the server in development)', async () => {
    answerWith(200);
    await api.get('/therapists');
    expect(lastRequest?.baseURL).toBe('/api');
  });
});

describe('response interceptor (automatic logout)', () => {
  it('announces an expired session when the server answers 401 while a token is held', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-token');
    answerWith(401, { message: 'Invalid or expired token' });
    await expect(api.get('/therapists/me')).rejects.toBeInstanceOf(AxiosError);
    expect(expiredEvents).toBe(1);
  });

  it('does NOT announce it for a failed login (401 without a token)', async () => {
    answerWith(401, { message: 'Invalid email or password' });
    await expect(api.post('/auth/login', {})).rejects.toBeInstanceOf(AxiosError);
    expect(expiredEvents).toBe(0);
  });

  it('announces it when an admin suspends the logged-in account (403 "Account suspended")', async () => {
    localStorage.setItem(TOKEN_KEY, 'token');
    answerWith(403, { message: 'Account suspended' });
    await expect(api.get('/therapists/me')).rejects.toBeInstanceOf(AxiosError);
    expect(expiredEvents).toBe(1);
  });

  it.each([
    [403, { message: 'Forbidden' }],
    [404, { message: 'Not found' }],
    [429, { message: 'Too many requests' }],
    [500, { message: 'Internal server error' }],
  ])('does not log the user out for an ordinary %i', async (status, body) => {
    localStorage.setItem(TOKEN_KEY, 'token');
    answerWith(status, body);
    await expect(api.get('/x')).rejects.toBeInstanceOf(AxiosError);
    expect(expiredEvents).toBe(0);
  });

  it('still passes the original error on to the caller', async () => {
    localStorage.setItem(TOKEN_KEY, 'token');
    answerWith(401);
    await expect(api.get('/x')).rejects.toMatchObject({ response: { status: 401 } });
  });
});
