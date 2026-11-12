import { describe, expect, it } from 'vitest';
import { api } from './helpers.js';

// This file is kept on its own: it deliberately exhausts the login rate limit for its (per-file) app instance.
describe('rate limiting of login / register', () => {
  it('blocks an IP after too many FAILED attempts, with a 429 and the standard rate-limit headers', async () => {
    const attempt = () => api().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password-123' });

    // Outside production the limit is 200 failed attempts per 15 minutes (20 in production).
    for (let i = 0; i < 200; i += 1) {
      const res = await attempt();
      if (res.status !== 401) throw new Error(`attempt ${i + 1} returned ${res.status}, expected 401`);
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many failed attempts/i);
    expect(blocked.headers['ratelimit']).toBeDefined();
  });

  it('applies to registration too (same counter), so scripted account creation is limited', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'someone@example.com', password: 'Register-pass-123' });
    expect(res.status).toBe(429);
  });

  it('does not limit the rest of the API', async () => {
    expect((await api().get('/api/therapists')).status).toBe(200);
  });
});
