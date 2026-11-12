import { beforeEach, describe, expect, it } from 'vitest';
import { TherapistProfile } from '../src/models/TherapistProfile.js';
import { User } from '../src/models/User.js';
import { api, bearer, createCategory, createTherapist, resetDb } from './helpers.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeEach(resetDb);

interface Card {
  slug: string;
  fullName: string;
}
const names = (res: { body: { items: Card[] } }): string[] => res.body.items.map((i) => i.fullName);

describe('GET /api/therapists (public directory)', () => {
  it('lists only therapists that are visible AND have a name', async () => {
    await createTherapist({ fullName: 'נראית א' });
    await createTherapist({ fullName: 'נראית ב' });
    await createTherapist({ fullName: 'ממתינה', status: 'PENDING_APPROVAL' }); // hidden: waiting for approval
    await createTherapist({ fullName: 'מושעית', status: 'SUSPENDED' }); //          hidden: suspended
    await createTherapist({ fullName: 'מוסתרת', visible: false }); //               hidden: switched off
    await createTherapist({ fullName: '' }); //                                      visible but still unnamed

    const res = await api().get('/api/therapists');
    expect(res.status).toBe(200);
    expect(names(res).sort()).toEqual(['נראית א', 'נראית ב']);
    expect(res.body.total).toBe(2);
  });

  it('returns an empty list (not an error) when there is nobody', async () => {
    const res = await api().get('/api/therapists');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, page: 1, limit: 12, totalPages: 0 });
  });

  it('shows the newest profile first', async () => {
    await createTherapist({ fullName: 'ראשונה' });
    await sleep(15);
    await createTherapist({ fullName: 'שנייה' });
    await sleep(15);
    await createTherapist({ fullName: 'שלישית' });
    expect(names(await api().get('/api/therapists'))).toEqual(['שלישית', 'שנייה', 'ראשונה']);
  });

  it('returns compact cards that leak nothing private', async () => {
    await createCategory('anxiety', 'חרדה');
    const t = await createTherapist({
      fullName: 'דנה',
      categories: ['anxiety'],
      profile: { professionalTitle: 'פסיכולוגית', city: 'חיפה', region: 'NORTH', acceptsOnline: true, bio: 'ביו', contactInfo: { phone: '050-1111111' } },
    });
    const res = await api().get('/api/therapists');
    const card = res.body.items[0];

    expect(card).toEqual({
      id: t.profileId,
      slug: t.slug,
      fullName: 'דנה',
      professionalTitle: 'פסיכולוגית',
      city: 'חיפה',
      region: 'NORTH',
      acceptsOnline: true,
      bioSnippet: 'ביו',
      categories: [{ id: expect.any(String), name: 'חרדה', slug: 'anxiety' }],
    });
    for (const secret of ['userId', 'contactInfo', 'certificates', 'bio', 'isPubliclyVisible', 'email', 'passwordHash']) {
      expect(card).not.toHaveProperty(secret);
    }
  });

  describe('pagination', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 7; i += 1) await createTherapist({ fullName: `מטפל ${i}` });
    });

    it('splits results into pages and reports totals', async () => {
      const p1 = await api().get('/api/therapists?limit=3&page=1');
      const p2 = await api().get('/api/therapists?limit=3&page=2');
      const p3 = await api().get('/api/therapists?limit=3&page=3');
      expect(p1.body).toMatchObject({ total: 7, page: 1, limit: 3, totalPages: 3 });
      expect([p1, p2, p3].map((r) => r.body.items.length)).toEqual([3, 3, 1]);
      const all = [...p1.body.items, ...p2.body.items, ...p3.body.items].map((i: Card) => i.slug);
      expect(new Set(all).size).toBe(7); // no duplicates, nothing missing
    });

    it('returns an empty page beyond the last one', async () => {
      const res = await api().get('/api/therapists?limit=3&page=99');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(7);
    });

    it.each(['page=0', 'page=-1', 'page=abc', 'limit=0', 'limit=51', 'limit=500'])('rejects %s with 400', async (qs) => {
      expect((await api().get(`/api/therapists?${qs}`)).status).toBe(400);
    });
  });

  describe('keyword search (q)', () => {
    beforeEach(async () => {
      await createTherapist({ fullName: 'דנה כהן', profile: { professionalTitle: 'פסיכולוגית קלינית', city: 'חיפה', bio: 'מתמחה בחרדה' } });
      await createTherapist({ fullName: 'יוסי לוי', profile: { professionalTitle: 'עובד סוציאלי', city: 'תל אביב', bio: 'טיפול זוגי' } });
      await createTherapist({ fullName: 'Hannah Smith', profile: { city: 'Haifa', bio: 'CBT specialist' } });
    });

    it.each([
      ['the name', 'כהן', ['דנה כהן']],
      ['the professional title', 'סוציאלי', ['יוסי לוי']],
      ['the city', 'אביב', ['יוסי לוי']],
      ['the bio', 'זוגי', ['יוסי לוי']],
    ])('matches the %s', async (_where, q, expected) => {
      expect(names(await api().get(`/api/therapists?q=${encodeURIComponent(q)}`))).toEqual(expected);
    });

    it('ignores letter case', async () => {
      expect(names(await api().get('/api/therapists?q=HANNAH'))).toEqual(['Hannah Smith']);
      expect(names(await api().get('/api/therapists?q=haifa'))).toEqual(['Hannah Smith']);
    });

    it('returns nobody when nothing matches', async () => {
      expect((await api().get('/api/therapists?q=zzzzz')).body.total).toBe(0);
    });

    it('treats regex characters as plain text (no error, no match-all)', async () => {
      for (const q of ['.*', '(((', '[a-z]', '\\']) {
        const res = await api().get(`/api/therapists?q=${encodeURIComponent(q)}`);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(0);
      }
    });

    it('does not find hidden therapists', async () => {
      await createTherapist({ fullName: 'דנה נסתרת', status: 'PENDING_APPROVAL' });
      expect(names(await api().get(`/api/therapists?q=${encodeURIComponent('נסתרת')}`))).toEqual([]);
    });
  });

  describe('category filter', () => {
    it('returns only therapists in that category, and ignores unknown or deactivated ones', async () => {
      await createCategory('anxiety', 'חרדה');
      await createCategory('retired', 'ישנה', false);
      await createTherapist({ fullName: 'א', categories: ['anxiety'] });
      await createTherapist({ fullName: 'ב', categories: [] });

      expect(names(await api().get('/api/therapists?category=anxiety'))).toEqual(['א']);
      expect((await api().get('/api/therapists?category=nope')).body.total).toBe(0);
      expect((await api().get('/api/therapists?category=retired')).body.total).toBe(0);
    });
  });
});

describe('GET /api/therapists/:slug (public profile)', () => {
  it('returns the full public profile, including the contact details meant for clients', async () => {
    await createCategory('anxiety', 'חרדה');
    const t = await createTherapist({
      fullName: 'דנה כהן',
      categories: ['anxiety'],
      profile: {
        professionalTitle: 'פסיכולוגית',
        bio: 'ביו מלא',
        gender: 'FEMALE',
        city: 'חיפה',
        region: 'NORTH',
        acceptsOnline: true,
        targetAudiences: ['ADULTS'],
        contactInfo: { phone: '050-1234567', whatsapp: '0501234567', email: 'dana@example.com' },
      },
    });

    const res = await api().get(`/api/therapists/${encodeURIComponent(t.slug as string)}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: t.profileId,
      slug: t.slug,
      fullName: 'דנה כהן',
      bio: 'ביו מלא',
      gender: 'FEMALE',
      region: 'NORTH',
      acceptsOnline: true,
      targetAudiences: ['ADULTS'],
      contactInfo: { phone: '050-1234567', whatsapp: '0501234567', email: 'dana@example.com' },
      hasVerifiedCertificates: false,
      isPubliclyVisible: true,
    });
  });

  it('never exposes the account id, e-mail login or certificate files', async () => {
    const t = await createTherapist({ fullName: 'דנה' });
    await TherapistProfile.updateOne(
      { _id: t.profileId },
      { $push: { certificates: { title: 'סודי', fileUrl: 'certificates/secret-key.pdf', originalName: 'x.pdf', isVerified: true } } },
    );
    const res = await api().get(`/api/therapists/${encodeURIComponent(t.slug as string)}`);
    const text = JSON.stringify(res.body);

    expect(res.body.hasVerifiedCertificates).toBe(true); // only the fact, never the files
    expect(res.body).not.toHaveProperty('userId');
    expect(res.body).not.toHaveProperty('certificates');
    expect(text).not.toContain('secret-key');
    expect(text).not.toContain(t.email);
  });

  it.each([
    ['pending approval', { status: 'PENDING_APPROVAL' as const }],
    ['suspended', { status: 'SUSPENDED' as const }],
    ['switched off', { visible: false }],
  ])('returns 404 for a profile that is %s', async (_label, options) => {
    const t = await createTherapist({ fullName: 'נסתרת', ...options });
    expect((await api().get(`/api/therapists/${encodeURIComponent(t.slug as string)}`)).status).toBe(404);
  });

  it('returns 404 for an unknown slug', async () => {
    expect((await api().get('/api/therapists/no-such-therapist')).status).toBe(404);
  });

  it('does not mistake "me" or "filter-options" for a slug', async () => {
    expect((await api().get('/api/therapists/me')).status).toBe(401); // the protected route, not a profile lookup
    expect((await api().get('/api/therapists/filter-options')).status).toBe(200);
  });
});

describe('GET /api/therapists/filter-options', () => {
  it('lists the cities of visible therapists with counts, most common first', async () => {
    await createTherapist({ fullName: 'א', profile: { city: 'חיפה' } });
    await createTherapist({ fullName: 'ב', profile: { city: 'חיפה' } });
    await createTherapist({ fullName: 'ג', profile: { city: 'עכו' } });
    await createTherapist({ fullName: 'ד', profile: { city: 'צפת' }, status: 'PENDING_APPROVAL' }); // hidden
    await createTherapist({ fullName: 'ה', profile: { city: '' } }); //                              no city

    const res = await api().get('/api/therapists/filter-options');
    expect(res.status).toBe(200);
    expect(res.body.cities).toEqual([
      { name: 'חיפה', count: 2 },
      { name: 'עכו', count: 1 },
    ]);
  });
});

describe('own profile: GET / PUT /api/therapists/me', () => {
  it('returns the owner view with certificates and the account status', async () => {
    const t = await createTherapist({ fullName: 'דנה', status: 'PENDING_APPROVAL' });
    const res = await api().get('/api/therapists/me').set(bearer(t.token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fullName: 'דנה', accountStatus: 'PENDING_APPROVAL', isPubliclyVisible: false, certificates: [] });
  });

  it('only shows the owner their own profile', async () => {
    const a = await createTherapist({ fullName: 'אחת' });
    await createTherapist({ fullName: 'שנייה' });
    const res = await api().get('/api/therapists/me').set(bearer(a.token));
    expect(res.body.fullName).toBe('אחת');
  });

  it('returns 404 for a therapist account that has no profile document', async () => {
    const t = await createTherapist({ withProfile: false });
    expect((await api().get('/api/therapists/me').set(bearer(t.token))).status).toBe(404);
  });

  it('updates only the fields that were sent', async () => {
    await createCategory('anxiety', 'חרדה');
    await createCategory('trauma', 'טראומה');
    const t = await createTherapist({ fullName: 'דנה', profile: { city: 'חיפה', bio: 'ביו ישן' }, categories: ['anxiety'] });

    const res = await api()
      .put('/api/therapists/me')
      .set(bearer(t.token))
      .send({ bio: '  ביו חדש  ', phone: '050-123-4567', contactEmail: 'x@example.com', categories: ['trauma'] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      fullName: 'דנה', //     untouched
      city: 'חיפה', //        untouched
      bio: 'ביו חדש', //      trimmed
      contactInfo: { phone: '050-123-4567', email: 'x@example.com' },
    });
    expect(res.body.categories.map((c: { slug: string }) => c.slug)).toEqual(['trauma']);
  });

  it('saves the fields the public search filters on, and null clears gender and region', async () => {
    const t = await createTherapist({ fullName: 'דנה' });
    const set = await api()
      .put('/api/therapists/me')
      .set(bearer(t.token))
      .send({ gender: 'FEMALE', region: 'CENTER', acceptsOnline: true, targetAudiences: ['TEENS', 'TEENS', 'ADULTS'] });
    expect(set.body).toMatchObject({ gender: 'FEMALE', region: 'CENTER', acceptsOnline: true });
    expect([...set.body.targetAudiences].sort()).toEqual(['ADULTS', 'TEENS']); // de-duplicated

    const cleared = await api().put('/api/therapists/me').set(bearer(t.token)).send({ gender: null, region: null, targetAudiences: [] });
    expect(cleared.body.gender).toBeUndefined();
    expect(cleared.body.region).toBeUndefined();
    expect(cleared.body.targetAudiences).toEqual([]);
  });

  it('removes duplicate categories', async () => {
    await createCategory('anxiety', 'חרדה');
    const t = await createTherapist();
    const res = await api().put('/api/therapists/me').set(bearer(t.token)).send({ categories: ['anxiety', 'anxiety'] });
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
  });

  it.each([
    ['a full name that is too short', { fullName: 'א' }],
    ['a full name that is too long', { fullName: 'א'.repeat(101) }],
    ['a bio that is too long', { bio: 'א'.repeat(3001) }],
    ['a phone number with letters', { phone: '050-abc' }],
    ['an invalid contact e-mail', { contactEmail: 'not-an-email' }],
    ['an unknown category', { categories: ['does-not-exist'] }],
    ['more than 10 categories', { categories: Array.from({ length: 11 }, (_, i) => `c${i}`) }],
    ['an unknown gender', { gender: 'ALIEN' }],
    ['an unknown region', { region: 'MARS' }],
    ['an unknown target audience', { targetAudiences: ['ROBOTS'] }],
    ['a non-boolean acceptsOnline', { acceptsOnline: 'yes' }],
  ])('rejects %s with 400', async (_label, body) => {
    const t = await createTherapist({ fullName: 'דנה' });
    expect((await api().put('/api/therapists/me').set(bearer(t.token)).send(body)).status).toBe(400);
  });

  it('refuses a deactivated category', async () => {
    await createCategory('retired', 'ישנה', false);
    const t = await createTherapist();
    expect((await api().put('/api/therapists/me').set(bearer(t.token)).send({ categories: ['retired'] })).status).toBe(400);
  });

  it('cannot be used to approve yourself or take over other fields (mass assignment)', async () => {
    const t = await createTherapist({ fullName: 'דנה', status: 'PENDING_APPROVAL' });
    const before = await TherapistProfile.findById(t.profileId);

    const res = await api().put('/api/therapists/me').set(bearer(t.token)).send({
      bio: 'ביו תקין',
      isPubliclyVisible: true,
      status: 'ACTIVE',
      accountStatus: 'ACTIVE',
      role: 'ADMIN',
      userId: '507f1f77bcf86cd799439011',
      slug: 'hacked-slug',
      profileImageUrl: 'https://evil.example/x.png',
      certificates: [{ title: 'fake', fileUrl: 'x', isVerified: true }],
    });

    expect(res.status).toBe(200);
    const profile = await TherapistProfile.findById(t.profileId);
    expect(profile?.bio).toBe('ביו תקין'); // the legitimate field was applied
    expect(profile?.isPubliclyVisible).toBe(false);
    expect(profile?.slug).toBe(before?.slug);
    expect(String(profile?.userId)).toBe(t.userId);
    expect(profile?.profileImageUrl).toBeUndefined();
    expect(profile?.certificates).toHaveLength(0);
    const user = await User.findById(t.userId);
    expect(user?.role).toBe('THERAPIST');
    expect(user?.status).toBe('PENDING_APPROVAL');
  });

  it('keeps a pending profile hidden even after the owner edits it', async () => {
    const t = await createTherapist({ fullName: 'דנה', status: 'PENDING_APPROVAL' });
    await api().put('/api/therapists/me').set(bearer(t.token)).send({ bio: 'עדכון' });
    expect((await api().get('/api/therapists')).body.total).toBe(0);
  });

  it('hides a deactivated category from the profile without deleting the data', async () => {
    const cat = await createCategory('anxiety', 'חרדה');
    const t = await createTherapist({ categories: ['anxiety'] });
    await cat.updateOne({ isActive: false });
    const res = await api().get(`/api/therapists/${encodeURIComponent(t.slug as string)}`);
    expect(res.body.categories).toEqual([]);
    expect((await TherapistProfile.findById(t.profileId))?.categories).toHaveLength(1);
  });
});
