import axios from 'axios';

export const TOKEN_KEY = 'auth_token';
export const AUTH_EXPIRED_EVENT = 'auth:expired';

export const api = axios.create({ baseURL: '/api' });

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  } catch {
    /* storage unavailable: continue unauthenticated */
  }
  return config;
});

// A 401 while we hold a token means it expired or was invalidated, and "Account suspended" means an admin
// suspended this user: in both cases tell AuthContext to log out.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const data: unknown = axios.isAxiosError(error) ? error.response?.data : undefined;
    const suspended =
      axios.isAxiosError(error) &&
      error.response?.status === 403 &&
      typeof data === 'object' &&
      data !== null &&
      (data as { message?: unknown }).message === 'Account suspended';
    if (axios.isAxiosError(error) && (error.response?.status === 401 || suspended)) {
      let hadToken = false;
      try {
        hadToken = localStorage.getItem(TOKEN_KEY) !== null;
      } catch {
        /* ignore */
      }
      if (hadToken) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);
