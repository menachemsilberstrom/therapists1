import mongoose from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import { Category } from '../src/models/Category.js';
import { TherapistProfile } from '../src/models/TherapistProfile.js';
import { User } from '../src/models/User.js';
import { api, bearer, createAdmin, createCategory, createTherapist, registerTherapist, resetDb, uniq } from './helpers.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let admin: Awaited<ReturnType<typeof createAdmin>>;

beforeEach(async () => {
  await resetDb();
  admin = await createAdmin();
});

const asAdmin = {
  get: (url: string) => api().get(url).set(bearer(admin.token)),
  post: (url: string, body: object) => api().post(url).set(bearer(admin.token)).send(body),
  patch: (url: string, body: object) => api().patch(url).set(bearer(admin.token)).send(body),
  delete: (url: string, body?: object) => api().delete(url).set(bearer(admin.token)).send(body ?? {}),
};

describe('approval workflow, end to end', () => {
  it('a new registration is invisible until an admin approves it, and invisible again once suspended', async () => {
    const reg = await registerTherapist('דנה כהן');
    await api().put('/api/therapists/me').set(bearer(reg.token)).send({ bio: 'ביו' });
    const profile = await TherapistProfile.findOne({ userId: reg.userId });
    const slug = encodeURIComponent(profile?.slug as string);

    // 1. pending: not listed, not reachable, but the owner can still sign in
    expect((await api().get('/api/therapists')).body.total).toBe(0);
    expect((await api().get(`/api/therapists/${slug}`)).status).toBe(404);
    expect((await api().get('/api/therapists/me').set(bearer(reg.token))).body.accountStatus).toBe('PENDING_APPROVAL');

    // 2. the admin sees it in the queue and approves it
    const queue = await asAdmin.get('/api/admin/therapists?status=PENDING_APPROVAL');
    expect(queue.body.items.map((i: { id: string }) => i.id)).toContain(reg.userId);
    const approved = await asAdmin.patch(`/api/admin/therapists/${reg.userId}/status`, { status: 'ACTIVE' });
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ accountStatus: 'ACTIVE', isPubliclyVisible: true });

    // 3. live: listed and reachable, the SAME token now shows an active account
    expect((await api().get('/api/therapists')).body.total).toBe(1);
    expect((await api().get(`/api/therapists/${slug}`)).status).toBe(200);
    expect((await api().get('/api/therapists/me').set(bearer(reg.token))).body).toMatchObject({ accountStatus: 'ACTIVE', isPubliclyVisible: true });

    // 4. suspended: hidden again and locked out immediately
    const suspended = await asAdmin.patch(`/api/admin/therapists/${reg.userId}/status`, { status: 'SUSPENDED' });
    expect(suspended.body).toMatchObject({ accountStatus: 'SUSPENDED', isPubliclyVisible: false });
    expect((await api().get(`/api/therapists/${slug}`)).status).toBe(404);
    expect((await api().get('/api/therapists')).body.total).toBe(0);
    expect((await api().get('/api/therapists/me').set(bearer(reg.token))).status).toBe(403);
    expect((await api().post('/api/auth/login').send({ email: reg.email, password: reg.password })).status).toBe(403);

    // 5. reactivated: live again
    await asAdmin.patch(`/api/admin/therapists/${reg.userId}/status`, { status: 'ACTIVE' });
    expect((await api().get(`/api/therapists/${slug}`)).status).toBe(200);
    expect((await api().get('/api/therapists/me').set(bearer(reg.token))).status).toBe(200);
  });

  it('keeps account status and profile visibility in step', async () => {
    const t = await createTherapist({ status: 'PENDING_APPROVAL', fullName: 'דנה' });
    await asAdmin.patch(`/api/admin/therapists/${t.userId}/status`, { status: 'ACTIVE' });
    expect((await User.findById(t.userId))?.status).toBe('ACTIVE');
    expect((await TherapistProfile.findById(t.profileId))?.isPubliclyVisible).toBe(true);

    await asAdmin.patch(`/api/admin/therapists/${t.userId}/status`, { status: 'SUSPENDED' });
    expect((await User.findById(t.userId))?.status).toBe('SUSPENDED');
    expect((await TherapistProfile.findById(t.profileId))?.isPubliclyVisible).toBe(false);
  });

  it('setting the same status twice is harmless', async () => {
    const t = await createTherapist({ fullName: 'דנה' });
    expect((await asAdmin.patch(`/api/admin/therapists/${t.userId}/status`, { status: 'ACTIVE' })).status).toBe(200);
    expect((await asAdmin.patch(`/api/admin/therapists/${t.userId}/status`, { status: 'ACTIVE' })).status).toBe(200);
  });

  it.each(['PENDING_APPROVAL', 'BANANA', '', 123])('refuses the status value %j with 400', async (status) => {
    const t = await createTherapist();
    expect((await asAdmin.patch(`/api/admin/therapists/${t.userId}/status`, { status })).status).toBe(400);
  });

  it('cannot approve an account that has no profile (409) but can suspend it', async () => {
    const orphan = await createTherapist({ withProfile: false, status: 'PENDING_APPROVAL' });
    const approve = await asAdmin.patch(`/api/admin/therapists/${orphan.userId}/status`, { status: 'ACTIVE' });
    expect(approve.status).toBe(409);
    expect(approve.body.code).toBe('NO_PROFILE');
    expect((await User.findById(orphan.userId))?.status).toBe('PENDING_APPROVAL');
    expect((await asAdmin.patch(`/api/admin/therapists/${orphan.userId}/status`, { status: 'SUSPENDED' })).status).toBe(200);
  });

  it('never lets admin endpoints act on an admin account', async () => {
    const other = await createAdmin();
    for (const res of [
      await asAdmin.get(`/api/admin/therapists/${other.userId}`),
      await asAdmin.patch(`/api/admin/therapists/${other.userId}/status`, { status: 'SUSPENDED' }),
      await asAdmin.delete(`/api/admin/therapists/${other.userId}`, { confirmEmail: other.email }),
    ]) {
      expect(res.status).toBe(404);
    }
    expect((await User.findById(other.userId))?.status).toBe('ACTIVE');
  });
});

describe('GET /api/admin/stats', () => {
  it('counts therapists by status and ignores admins', async () => {
    await createTherapist({ status: 'PENDING_APPROVAL' });
    await createTherapist({ status: 'PENDING_APPROVAL' });
    await createTherapist({ status: 'ACTIVE' });
    await createTherapist({ status: 'SUSPENDED' });
    await createTherapist({ withProfile: false, status: 'PENDING_APPROVAL' });
    const res = await asAdmin.get('/api/admin/stats');
    expect(res.body).toEqual({ pending: 3, active: 1, suspended: 1, total: 5 });
  });
});

describe('GET /api/admin/therapists', () => {
  it('lists every therapist account, including one without a profile, and never admins', async () => {
    await createTherapist({ fullName: 'עם פרופיל' });
    await createTherapist({ withProfile: false, email: 'orphan@example.com' });
    const res = await asAdmin.get('/api/admin/therapists');
    const rows = res.body.items as { email: string; hasProfile: boolean }[];
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.email === 'orphan@example.com')?.hasProfile).toBe(false);
    expect(rows.some((r) => r.email === admin.email)).toBe(false);
  });

  it('describes each account with the data an admin needs and nothing private', async () => {
    const t = await createTherapist({ fullName: 'דנה כהן', email: 'dana@example.com', profile: { professionalTitle: 'פסיכולוגית', city: 'חיפה' } });
    const row = (await asAdmin.get('/api/admin/therapists')).body.items[0];
    expect(row).toMatchObject({
      id: t.userId,
      email: 'dana@example.com',
      accountStatus: 'ACTIVE',
      isSeeded: false,
      hasProfile: true,
      fullName: 'דנה כהן',
      professionalTitle: 'פסיכולוגית',
      city: 'חיפה',
      isPubliclyVisible: true,
      certificateCount: 0,
      verifiedCertificateCount: 0,
    });
    expect(JSON.stringify(row)).not.toMatch(/passwordHash|fileUrl/);
  });

  it('marks the accounts created by the sample-data seed', async () => {
    await createTherapist({ fullName: 'דוגמה', email: 'seed-abc123@seed.invalid' });
    expect((await asAdmin.get('/api/admin/therapists')).body.items[0].isSeeded).toBe(true);
  });

  it('filters by status and searches name, e-mail, city and title', async () => {
    await createTherapist({ fullName: 'דנה כהן', email: 'dana@example.com', status: 'PENDING_APPROVAL', profile: { city: 'חיפה', professionalTitle: 'פסיכולוגית' } });
    await createTherapist({ fullName: 'יוסי לוי', email: 'yossi@example.com', status: 'ACTIVE', profile: { city: 'עכו', professionalTitle: 'עובד סוציאלי' } });

    const count = async (qs: string) => (await asAdmin.get(`/api/admin/therapists?${qs}`)).body.total as number;
    expect(await count('status=PENDING_APPROVAL')).toBe(1);
    expect(await count('status=ACTIVE')).toBe(1);
    expect(await count('status=SUSPENDED')).toBe(0);
    expect(await count(`q=${encodeURIComponent('כהן')}`)).toBe(1);
    expect(await count('q=yossi@')).toBe(1);
    expect(await count(`q=${encodeURIComponent('עכו')}`)).toBe(1);
    expect(await count(`q=${encodeURIComponent('סוציאלי')}`)).toBe(1);
    expect(await count(`q=${encodeURIComponent('כהן')}&status=ACTIVE`)).toBe(0);
    expect(await count('q=.*')).toBe(0); // regex characters are plain text
  });

  it('sorts oldest-first for the moderation queue and newest-first otherwise, with paging', async () => {
    const first = await createTherapist({ fullName: 'ראשונה', status: 'PENDING_APPROVAL' });
    await sleep(15);
    const second = await createTherapist({ fullName: 'שנייה', status: 'PENDING_APPROVAL' });
    await sleep(15);
    const third = await createTherapist({ fullName: 'שלישית', status: 'PENDING_APPROVAL' });

    const ids = (res: { body: { items: { id: string }[] } }) => res.body.items.map((i) => i.id);
    expect(ids(await asAdmin.get('/api/admin/therapists?sort=oldest'))).toEqual([first.userId, second.userId, third.userId]);
    expect(ids(await asAdmin.get('/api/admin/therapists?sort=newest'))).toEqual([third.userId, second.userId, first.userId]);
    const page2 = await asAdmin.get('/api/admin/therapists?sort=oldest&limit=2&page=2');
    expect(ids(page2)).toEqual([third.userId]);
    expect(page2.body).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2 });
  });

  it.each(['status=NOPE', 'limit=0', 'limit=51', 'page=0', 'sort=sideways'])('rejects %s with 400', async (qs) => {
    expect((await asAdmin.get(`/api/admin/therapists?${qs}`)).status).toBe(400);
  });
});

describe('GET /api/admin/therapists/:id', () => {
  it('returns the full profile for review, without storage keys', async () => {
    const t = await createTherapist({
      fullName: 'דנה',
      profile: { bio: 'ביו', gender: 'FEMALE', region: 'NORTH', acceptsOnline: true, targetAudiences: ['ADULTS'], contactInfo: { phone: '050-1111111' } },
    });
    await TherapistProfile.updateOne({ _id: t.profileId }, { $push: { certificates: { title: 'תואר', fileUrl: 'certificates/key-123.pdf', originalName: 'תואר.pdf' } } });

    const res = await asAdmin.get(`/api/admin/therapists/${t.userId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.userId, bio: 'ביו', gender: 'FEMALE', region: 'NORTH', contactInfo: { phone: '050-1111111' }, certificateCount: 1 });
    expect(res.body.certificates[0]).toMatchObject({ title: 'תואר', originalName: 'תואר.pdf', fileType: 'pdf', isVerified: false });
    expect(JSON.stringify(res.body)).not.toContain('key-123'); // only the file TYPE is exposed, never the path
  });

  it('returns 404 for an unknown account, 400 for a malformed id', async () => {
    expect((await asAdmin.get('/api/admin/therapists/507f1f77bcf86cd799439011')).status).toBe(404);
    expect((await asAdmin.get('/api/admin/therapists/not-an-id')).status).toBe(400);
  });
});

describe('DELETE /api/admin/therapists/:id (guarded deletion)', () => {
  it('refuses without the confirmation e-mail, or with the wrong one, and deletes nothing', async () => {
    const t = await createTherapist({ fullName: 'דנה' });
    expect((await asAdmin.delete(`/api/admin/therapists/${t.userId}`)).status).toBe(400);
    const wrong = await asAdmin.delete(`/api/admin/therapists/${t.userId}`, { confirmEmail: 'wrong@example.com' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('CONFIRMATION_MISMATCH');
    expect(await User.countDocuments({ _id: t.userId })).toBe(1);
    expect(await TherapistProfile.countDocuments({ _id: t.profileId })).toBe(1);
  });

  it('deletes the account and the profile when the e-mail matches (ignoring letter case)', async () => {
    const t = await createTherapist({ fullName: 'דנה', email: 'dana@example.com' });
    const res = await asAdmin.delete(`/api/admin/therapists/${t.userId}`, { confirmEmail: 'DANA@Example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, filesRemoved: 0 });
    expect(await User.countDocuments({ _id: t.userId })).toBe(0);
    expect(await TherapistProfile.countDocuments({ _id: t.profileId })).toBe(0);
    expect((await api().post('/api/auth/login').send({ email: 'dana@example.com', password: t.password })).status).toBe(401);
    expect((await api().get('/api/therapists/me').set(bearer(t.token))).status).toBe(401);
  });

  it('deletes an account that has no profile, and answers 404 the second time', async () => {
    const orphan = await createTherapist({ withProfile: false, email: 'orphan@example.com' });
    expect((await asAdmin.delete(`/api/admin/therapists/${orphan.userId}`, { confirmEmail: 'orphan@example.com' })).status).toBe(200);
    expect((await asAdmin.delete(`/api/admin/therapists/${orphan.userId}`, { confirmEmail: 'orphan@example.com' })).status).toBe(404);
  });

  it('only removes the targeted therapist', async () => {
    const a = await createTherapist({ fullName: 'א' });
    const b = await createTherapist({ fullName: 'ב' });
    await asAdmin.delete(`/api/admin/therapists/${a.userId}`, { confirmEmail: a.email });
    expect(await User.countDocuments({ _id: b.userId })).toBe(1);
    expect(await TherapistProfile.countDocuments({ _id: b.profileId })).toBe(1);
  });
});

describe('admin category management', () => {
  it('creates a category, normalising the slug', async () => {
    const res = await asAdmin.post('/api/admin/categories', { name: 'חרדה חברתית', slug: ' Social-Anxiety ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'חרדה חברתית', slug: 'social-anxiety', isActive: true, usageCount: 0 });
    expect((await api().get('/api/categories')).body.map((c: { slug: string }) => c.slug)).toContain('social-anxiety');
  });

  it('rejects duplicates and invalid input', async () => {
    await createCategory('anxiety', 'חרדה');
    const dupSlug = await asAdmin.post('/api/admin/categories', { name: 'שם אחר', slug: 'anxiety' });
    expect(dupSlug.status).toBe(409);
    expect(dupSlug.body.code).toBe('CATEGORY_SLUG_TAKEN');
    const dupName = await asAdmin.post('/api/admin/categories', { name: 'חרדה', slug: 'other' });
    expect(dupName.status).toBe(409);
    expect(dupName.body.code).toBe('CATEGORY_NAME_TAKEN');

    for (const body of [
      { name: 'שם', slug: 'עברית' }, //              non-latin slug
      { name: 'שם', slug: 'has space' },
      { name: 'שם', slug: '-leading-hyphen' },
      { name: 'שם', slug: 'double--hyphen' },
      { name: 'א', slug: 'ok-slug' }, //             name too short
      { slug: 'ok-slug' },
    ]) {
      expect((await asAdmin.post('/api/admin/categories', body)).status).toBe(400);
    }
  });

  it('renames without changing the slug, and refuses a name that is already taken', async () => {
    const a = await createCategory('anxiety', 'חרדה');
    await createCategory('trauma', 'טראומה');
    const renamed = await asAdmin.patch(`/api/admin/categories/${a.id as string}`, { name: 'חרדה ומתח' });
    expect(renamed.body).toMatchObject({ name: 'חרדה ומתח', slug: 'anxiety' });
    expect((await asAdmin.patch(`/api/admin/categories/${a.id as string}`, { name: 'טראומה' })).status).toBe(409);
  });

  it('deactivates and reactivates, hiding the category from the public list and from profiles', async () => {
    const cat = await createCategory('anxiety', 'חרדה');
    const t = await createTherapist({ fullName: 'דנה', categories: ['anxiety'] });
    const slug = encodeURIComponent(t.slug as string);

    const off = await asAdmin.patch(`/api/admin/categories/${cat.id as string}`, { isActive: false });
    expect(off.body).toMatchObject({ isActive: false, usageCount: 1 });
    expect((await api().get('/api/categories')).body).toEqual([]);
    expect((await api().get(`/api/therapists/${slug}`)).body.categories).toEqual([]);
    expect((await asAdmin.get('/api/admin/categories')).body[0]).toMatchObject({ slug: 'anxiety', isActive: false, usageCount: 1 }); // still listed for admins

    await asAdmin.patch(`/api/admin/categories/${cat.id as string}`, { isActive: true });
    expect((await api().get(`/api/therapists/${slug}`)).body.categories).toHaveLength(1);
  });

  it('rejects an empty update, an unknown id and a malformed id', async () => {
    const cat = await createCategory('anxiety', 'חרדה');
    expect((await asAdmin.patch(`/api/admin/categories/${cat.id as string}`, {})).status).toBe(400);
    expect((await asAdmin.patch('/api/admin/categories/507f1f77bcf86cd799439011', { name: 'שם חדש' })).status).toBe(404);
    expect((await asAdmin.patch('/api/admin/categories/not-an-id', { name: 'שם חדש' })).status).toBe(400);
  });

  it('counts how many profiles use each category', async () => {
    await createCategory('anxiety', 'חרדה');
    await createCategory('trauma', 'טראומה');
    await createTherapist({ categories: ['anxiety'] });
    await createTherapist({ categories: ['anxiety', 'trauma'] });
    const usage = Object.fromEntries((await asAdmin.get('/api/admin/categories')).body.map((c: { slug: string; usageCount: number }) => [c.slug, c.usageCount]));
    expect(usage).toEqual({ anxiety: 2, trauma: 1 });
  });

  it('ignores documents written by other applications that share the database', async () => {
    // Regression test: a budget app once shared this collection. Its documents have no slug, and some even have a `name`.
    const raw = mongoose.connection.db?.collection('categories');
    await raw?.insertMany([
      { name_he: 'אוכל', name_en: 'Food', userId: 'someone', color: '#fff', budgetLimit: 100 },
      { name: 'חרדה', color: '#000', userId: 'someone' },
    ]);

    expect((await asAdmin.get('/api/admin/categories')).body).toEqual([]); //                     not listed, not blank rows
    const created = await asAdmin.post('/api/admin/categories', { name: 'חרדה', slug: `anxiety-${uniq()}` });
    expect(created.status).toBe(201); //                                                           their `name` is not a duplicate
    const foreign = await raw?.findOne({ name_he: 'אוכל' });
    expect((await asAdmin.patch(`/api/admin/categories/${String(foreign?._id)}`, { name: 'נסיון' })).status).toBe(404); // cannot be edited
    expect(await Category.countDocuments({ slug: { $type: 'string' } })).toBe(1);
  });
});
