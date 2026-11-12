import { describe, expect, it } from 'vitest';
import { api } from './helpers.js';

describe('infrastructure', () => {
  it('serves the health check without authentication', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await api().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not found' });
  });

  it('sets security headers (helmet) and a request id', async () => {
    const res = await api().get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toMatch(/^[\w-]+$/);
  });

  it('reuses a well-formed X-Request-Id and ignores a malformed one', async () => {
    const good = await api().get('/api/health').set('X-Request-Id', 'abc-123');
    expect(good.headers['x-request-id']).toBe('abc-123');
    const bad = await api().get('/api/health').set('X-Request-Id', 'bad id with spaces');
    expect(bad.headers['x-request-id']).not.toBe('bad id with spaces');
  });

  it('allows the configured web client origin (CORS)', async () => {
    const res = await api().get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('runs against the isolated in-memory test database', async () => {
    const { default: mongoose } = await import('mongoose');
    expect(mongoose.connection.name).toMatch(/^test_[0-9a-f]{8}$/);
  });
});
