import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

/** Remaining requests in the current rate-limit window, as reported to the client. */
const remaining = (res: request.Response): number => Number(/remaining=(\d+)/.exec(String(res.headers['ratelimit']))?.[1]);

describe('CORS: which websites may call the API from a browser', () => {
  const WEB = 'https://my-site.vercel.app';
  const app = createApp({ corsOrigins: [WEB, 'https://my-domain.co.il'] });

  it.each([WEB, 'https://my-domain.co.il'])('allows the listed website %s', async (origin) => {
    const res = await request(app).get('/api/health').set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('does not allow any other website', async () => {
    for (const origin of ['https://evil.example', 'http://my-site.vercel.app', 'https://my-site.vercel.app.evil.example', 'null']) {
      const res = await request(app).get('/api/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  it('answers the browser preflight for an authenticated request from an allowed website', async () => {
    const res = await request(app)
      .options('/api/therapists/me')
      .set('Origin', WEB)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(WEB);
    expect(res.headers['access-control-allow-headers']?.toLowerCase()).toContain('authorization');
    expect(res.headers['access-control-allow-methods']).toMatch(/PUT/);
  });

  it('refuses the preflight from a website that is not listed', async () => {
    const res = await request(app)
      .options('/api/therapists/me')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'DELETE');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('parses CLIENT_ORIGIN from the environment (a single origin here)', async () => {
    const res = await request(createApp()).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('reverse proxy (Render): visitors are told apart by their real IP address', () => {
  it('behind one proxy, each visitor (X-Forwarded-For) gets their own rate-limit bucket', async () => {
    const app = createApp({ trustProxy: 1 });
    expect(app.get('trust proxy')).toBe(1);

    const a1 = await request(app).get('/api/therapists').set('X-Forwarded-For', '203.0.113.10');
    const a2 = await request(app).get('/api/therapists').set('X-Forwarded-For', '203.0.113.10');
    const b1 = await request(app).get('/api/therapists').set('X-Forwarded-For', '203.0.113.11');

    expect(remaining(a2)).toBe(remaining(a1) - 1); // the same visitor uses up their own allowance
    expect(remaining(b1)).toBe(remaining(a1)); //      a different visitor starts with a fresh one
  });

  it('with a proxy, only the address added by the proxy is trusted: extra spoofed entries do not help', async () => {
    const app = createApp({ trustProxy: 1 });
    const honest = await request(app).get('/api/therapists').set('X-Forwarded-For', '203.0.113.20');
    // an attacker prepends fake addresses; the proxy still appends the real one at the end
    const spoofed = await request(app).get('/api/therapists').set('X-Forwarded-For', '1.2.3.4, 5.6.7.8, 203.0.113.20');
    expect(remaining(spoofed)).toBe(remaining(honest) - 1); // counted against the same real address
  });

  it('with NO proxy configured, a forged X-Forwarded-For cannot be used to dodge the limit', async () => {
    const app = createApp({ trustProxy: 0 });
    expect(app.get('trust proxy')).toBe(false);

    const first = await request(app).get('/api/therapists').set('X-Forwarded-For', '198.51.100.1');
    const second = await request(app).get('/api/therapists').set('X-Forwarded-For', '198.51.100.2'); // "another" visitor
    expect(remaining(second)).toBe(remaining(first) - 1); // still the same bucket: the header was ignored
  });
});
