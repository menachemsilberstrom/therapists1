import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { TherapistProfile } from '../src/models/TherapistProfile.js';
import { User } from '../src/models/User.js';
import { api, bearer, createAdmin, createTherapist, registerTherapist, resetDb, tokenFor, uniq } from './helpers.js';

beforeEach(resetDb);

describe('POST /api/auth/register', () => {
  it('creates a therapist account that is pending approval and returns a token', async () => {
    const { res, email } = await registerTherapist('דנה כהן');

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      email,
      role: 'THERAPIST',
      status: 'PENDING_APPROVAL',
    });
  });

  it('never returns the password or its hash', async () => {
    const { res } = await registerTherapist();
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/passwordHash|password/i);
  });

  it('stores only a bcrypt hash of the password', async () => {
    const { email, password } = await registerTherapist();
    const stored = await User.findOne({ email }).select('+passwordHash');
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toContain(password);
  });

  it('creates an empty profile that is hidden from the public', async () => {
    const { userId } = await registerTherapist('דנה כהן');
    const profile = await TherapistProfile.findOne({ userId });
    expect(profile).not.toBeNull();
    expect(profile?.isPubliclyVisible).toBe(false);
    expect(profile?.fullName).toBe('דנה כהן');
    expect(profile?.slug).toMatch(/^דנה-כהן-[0-9a-f]{6}$/); // unicode slug + random suffix
  });

  it('gives two therapists with the same name different slugs', async () => {
    const a = await registerTherapist('דנה כהן');
    const b = await registerTherapist('דנה כהן');
    const [pa, pb] = await Promise.all([TherapistProfile.findOne({ userId: a.userId }), TherapistProfile.findOne({ userId: b.userId })]);
    expect(pa?.slug).not.toBe(pb?.slug);
  });

  it('stores the e-mail address in lower case', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'Mixed.Case@Example.COM', password: 'Register-pass-123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('mixed.case@example.com');
  });

  it('works without a full name', async () => {
    const res = await api().post('/api/auth/register').send({ email: `x-${uniq()}@example.com`, password: 'Register-pass-123' });
    expect(res.status).toBe(201);
    const profile = await TherapistProfile.findOne({ userId: res.body.user.id });
    expect(profile?.fullName).toBe('');
  });

  it('rejects a duplicate e-mail address, ignoring letter case, with 409', async () => {
    const first = await registerTherapist('א', 'dup@example.com');
    expect(first.res.status).toBe(201);
    const second = await api().post('/api/auth/register').send({ email: 'DUP@example.com', password: 'Register-pass-123' });
    expect(second.status).toBe(409);
    expect(await User.countDocuments({ email: 'dup@example.com' })).toBe(1);
  });

  it.each([
    ['an invalid e-mail address', { email: 'not-an-email', password: 'Register-pass-123' }],
    ['a missing e-mail address', { password: 'Register-pass-123' }],
    ['a password shorter than 8 characters', { email: 'a@example.com', password: 'short' }],
    ['a missing password', { email: 'a@example.com' }],
    ['a password longer than 128 characters', { email: 'a@example.com', password: 'x'.repeat(129) }],
    ['a full name longer than 100 characters', { email: 'a@example.com', password: 'Register-pass-123', fullName: 'א'.repeat(101) }],
    ['an empty body', {}],
    ['an object instead of an e-mail string (NoSQL injection attempt)', { email: { $ne: null }, password: 'Register-pass-123' }],
  ])('rejects %s with 400 and creates nothing', async (_label, body) => {
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(await User.countDocuments()).toBe(0);
    expect(await TherapistProfile.countDocuments()).toBe(0);
  });

  it('ignores attempts to choose a role or status', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ email: `sneaky-${uniq()}@example.com`, password: 'Register-pass-123', role: 'ADMIN', status: 'ACTIVE' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('THERAPIST');
    expect(res.body.user.status).toBe('PENDING_APPROVAL');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token and the user for correct credentials', async () => {
    const t = await createTherapist();
    const res = await api().post('/api/auth/login').send({ email: t.email, password: t.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: t.userId, email: t.email, role: 'THERAPIST', status: 'ACTIVE' });
    const payload = jwt.verify(res.body.token as string, env.JWT_SECRET) as { userId: string };
    expect(payload.userId).toBe(t.userId);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('ignores letter case in the e-mail address', async () => {
    const t = await createTherapist({ email: 'case@example.com' });
    const res = await api().post('/api/auth/login').send({ email: 'CASE@Example.com', password: t.password });
    expect(res.status).toBe(200);
  });

  it('works right after registering', async () => {
    const { email, password } = await registerTherapist();
    const res = await api().post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('PENDING_APPROVAL');
  });

  it('rejects a wrong password with 401 and a generic message', async () => {
    const t = await createTherapist();
    const res = await api().post('/api/auth/login').send({ email: t.email, password: 'wrong-password-123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
    expect(res.body.token).toBeUndefined();
  });

  it('answers an unknown e-mail exactly like a wrong password (no user enumeration)', async () => {
    const t = await createTherapist();
    const wrongPassword = await api().post('/api/auth/login').send({ email: t.email, password: 'wrong-password-123' });
    const unknownUser = await api().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password-123' });
    expect(unknownUser.status).toBe(wrongPassword.status);
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it('refuses a suspended account with 403', async () => {
    const t = await createTherapist({ status: 'SUSPENDED' });
    const res = await api().post('/api/auth/login').send({ email: t.email, password: t.password });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Account suspended');
  });

  it('does not reveal a suspended account to someone who has the wrong password', async () => {
    const t = await createTherapist({ status: 'SUSPENDED' });
    const res = await api().post('/api/auth/login').send({ email: t.email, password: 'wrong-password-123' });
    expect(res.status).toBe(401);
  });

  it('signs an admin in with the ADMIN role', async () => {
    const admin = await createAdmin();
    const res = await api().post('/api/auth/login').send({ email: admin.email, password: admin.password });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
  });

  it.each([
    ['a missing password', { email: 'a@example.com' }],
    ['an invalid e-mail', { email: 'nope', password: 'whatever-123' }],
    ['operator objects instead of strings (NoSQL injection attempt)', { email: { $gt: '' }, password: { $gt: '' } }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await api().post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
  });
});

describe('authentication token', () => {
  const protectedUrl = '/api/therapists/me';

  it('lets a valid token through', async () => {
    const t = await createTherapist();
    const res = await api().get(protectedUrl).set(bearer(t.token));
    expect(res.status).toBe(200);
  });

  it('rejects a request without a token', async () => {
    const res = await api().get(protectedUrl);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authentication required');
  });

  it.each([
    ['a wrong scheme', 'Basic abc123'],
    ['no scheme', 'justatoken'],
    ['a garbage token', 'Bearer not.a.jwt'],
    ['an empty token', 'Bearer '],
  ])('rejects %s', async (_label, header) => {
    const res = await api().get(protectedUrl).set('Authorization', header);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const t = await createTherapist();
    const forged = jwt.sign({ userId: t.userId }, 'some-other-secret-entirely-different');
    expect((await api().get(protectedUrl).set(bearer(forged))).status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const t = await createTherapist();
    const expired = tokenFor(t.userId, -60);
    const res = await api().get(protectedUrl).set(bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  it('rejects a token whose payload was edited (signature no longer matches)', async () => {
    const t = await createTherapist();
    const admin = await createAdmin();
    const [header, , signature] = t.token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ userId: admin.userId, exp: 9999999999 })).toString('base64url');
    const tampered = `${header}.${forgedPayload}.${signature}`;
    expect((await api().get('/api/admin/stats').set(bearer(tampered))).status).toBe(401);
  });

  it('rejects an unsigned token (alg "none")', async () => {
    const admin = await createAdmin();
    const unsigned = jwt.sign({ userId: admin.userId }, '', { algorithm: 'none' });
    expect((await api().get('/api/admin/stats').set(bearer(unsigned))).status).toBe(401);
  });

  it('rejects the token of an account that no longer exists', async () => {
    const t = await createTherapist();
    await User.deleteOne({ _id: t.userId });
    expect((await api().get(protectedUrl).set(bearer(t.token))).status).toBe(401);
  });
});
