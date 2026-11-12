import { beforeEach, describe, expect, it } from 'vitest';
import { User } from '../src/models/User.js';
import { api, bearer, createAdmin, createTherapist, resetDb } from './helpers.js';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
const ID = '507f1f77bcf86cd799439011'; // a well-formed id that does not exist

const publicRoutes: [Method, string][] = [
  ['get', '/api/health'],
  ['get', '/api/therapists'],
  ['get', '/api/therapists/filter-options'],
  ['get', '/api/categories'],
];

const therapistOnlyRoutes: [Method, string][] = [
  ['get', '/api/therapists/me'],
  ['put', '/api/therapists/me'],
  ['post', '/api/therapists/me/avatar'],
  ['delete', '/api/therapists/me/avatar'],
  ['post', '/api/therapists/me/certificates'],
  ['delete', `/api/therapists/me/certificates/${ID}`],
];

const adminOnlyRoutes: [Method, string][] = [
  ['get', '/api/admin/stats'],
  ['get', '/api/admin/therapists'],
  ['get', `/api/admin/therapists/${ID}`],
  ['patch', `/api/admin/therapists/${ID}/status`],
  ['delete', `/api/admin/therapists/${ID}`],
  ['get', `/api/admin/therapists/${ID}/certificates/${ID}/file`],
  ['patch', `/api/admin/therapists/${ID}/certificates/${ID}`],
  ['get', '/api/admin/categories'],
  ['post', '/api/admin/categories'],
  ['patch', `/api/admin/categories/${ID}`],
];

beforeEach(resetDb);

const call = (method: Method, url: string, token?: string) => {
  const req = api()[method](url);
  return token ? req.set(bearer(token)) : req;
};

describe('public routes', () => {
  it.each(publicRoutes)('%s %s needs no login', async (method, url) => {
    expect((await call(method, url)).status).toBe(200);
  });
});

describe('anonymous visitors', () => {
  it.each([...therapistOnlyRoutes, ...adminOnlyRoutes])('%s %s -> 401', async (method, url) => {
    expect((await call(method, url)).status).toBe(401);
  });
});

describe('a therapist', () => {
  it.each(adminOnlyRoutes)('is blocked from %s %s with 403', async (method, url) => {
    const t = await createTherapist();
    expect((await call(method, url, t.token)).status).toBe(403);
  });

  it('can use the therapist-only routes', async () => {
    const t = await createTherapist();
    expect((await call('get', '/api/therapists/me', t.token)).status).toBe(200);
  });

  it('is blocked (403) from the admin panel even while waiting for approval', async () => {
    const t = await createTherapist({ status: 'PENDING_APPROVAL' });
    expect((await call('get', '/api/admin/stats', t.token)).status).toBe(403);
  });
});

describe('an admin', () => {
  it.each(therapistOnlyRoutes)('is blocked from the therapist-only route %s %s with 403', async (method, url) => {
    const admin = await createAdmin();
    expect((await call(method, url, admin.token)).status).toBe(403);
  });

  it('can use the admin routes', async () => {
    const admin = await createAdmin();
    for (const url of ['/api/admin/stats', '/api/admin/therapists', '/api/admin/categories']) {
      expect((await call('get', url, admin.token)).status).toBe(200);
    }
  });
});

describe('the role and status come from the database, not from the token', () => {
  it('a promoted user gets admin access on the very next request, with the same token', async () => {
    const t = await createTherapist();
    expect((await call('get', '/api/admin/stats', t.token)).status).toBe(403);
    await User.updateOne({ _id: t.userId }, { role: 'ADMIN' });
    expect((await call('get', '/api/admin/stats', t.token)).status).toBe(200);
  });

  it('a demoted admin loses access immediately', async () => {
    const admin = await createAdmin();
    expect((await call('get', '/api/admin/stats', admin.token)).status).toBe(200);
    await User.updateOne({ _id: admin.userId }, { role: 'THERAPIST' });
    expect((await call('get', '/api/admin/stats', admin.token)).status).toBe(403);
  });

  it('a suspended therapist is locked out of every protected route immediately', async () => {
    const t = await createTherapist();
    expect((await call('get', '/api/therapists/me', t.token)).status).toBe(200);
    await User.updateOne({ _id: t.userId }, { status: 'SUSPENDED' });
    const res = await call('get', '/api/therapists/me', t.token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Account suspended');
  });

  it('a suspended admin is locked out too', async () => {
    const admin = await createAdmin();
    await User.updateOne({ _id: admin.userId }, { status: 'SUSPENDED' });
    expect((await call('get', '/api/admin/stats', admin.token)).status).toBe(403);
  });

  it('a pending therapist can use the dashboard API (they prepare their profile while waiting)', async () => {
    const t = await createTherapist({ status: 'PENDING_APPROVAL' });
    const res = await call('get', '/api/therapists/me', t.token);
    expect(res.status).toBe(200);
    expect(res.body.accountStatus).toBe('PENDING_APPROVAL');
  });
});
