import { beforeAll, describe, expect, it } from 'vitest';
import type { Gender, Region, TargetAudience } from '../src/models/TherapistProfile.js';
import { api, createCategory, createTherapist, resetDb } from './helpers.js';

interface Person {
  name: string;
  gender?: Gender;
  region?: Region;
  city: string;
  audiences: TargetAudience[];
  online: boolean;
  categories: string[];
}

// A small directory where the right answer to every filter can be worked out by eye or by a one-line filter().
const PEOPLE: Person[] = [
  { name: 'אורי', gender: 'MALE', region: 'NORTH', city: 'חיפה', audiences: ['ADULTS'], online: false, categories: ['anxiety'] },
  { name: 'בתיה', gender: 'FEMALE', region: 'NORTH', city: 'חיפה', audiences: ['TEENS', 'ADULTS'], online: true, categories: ['trauma'] },
  { name: 'גילה', gender: 'FEMALE', region: 'CENTER', city: 'תל אביב', audiences: ['CHILDREN'], online: true, categories: ['youth', 'anxiety'] },
  { name: 'דן', gender: 'MALE', region: 'CENTER', city: 'רמת גן', audiences: ['COUPLES', 'ADULTS'], online: false, categories: ['trauma', 'youth'] },
  { name: 'הילה', gender: 'FEMALE', region: 'SOUTH', city: 'באר שבע', audiences: [], online: true, categories: [] },
  { name: 'ויקי', gender: 'FEMALE', region: 'JERUSALEM', city: 'ירושלים', audiences: ['PARENTS'], online: false, categories: ['anxiety'] },
  { name: 'Hannah', gender: 'FEMALE', region: 'NORTH', city: 'Haifa', audiences: ['ADULTS'], online: false, categories: ['anxiety'] },
  { name: 'זיו', city: '', audiences: [], online: false, categories: [] }, // a profile that left every optional field empty
];

const result = (res: { body: { items: { fullName: string }[] } }): string[] => res.body.items.map((i) => i.fullName).sort();
const expected = (predicate: (p: Person) => boolean): string[] => PEOPLE.filter(predicate).map((p) => p.name).sort();
const search = async (qs: string) => result(await api().get(`/api/therapists?limit=50&${qs}`));

beforeAll(async () => {
  await resetDb();
  for (const slug of ['anxiety', 'trauma', 'youth']) await createCategory(slug, slug);
  for (const p of PEOPLE) {
    await createTherapist({
      fullName: p.name,
      categories: p.categories,
      profile: { gender: p.gender, region: p.region, city: p.city, targetAudiences: p.audiences, acceptsOnline: p.online },
    });
  }
  // Hidden people who match EVERY filter below: they must never show up, whatever is asked.
  const everything = { gender: 'FEMALE' as const, region: 'NORTH' as const, city: 'חיפה', targetAudiences: ['TEENS' as const], acceptsOnline: true };
  await createTherapist({ fullName: 'נסתרת ממתינה', status: 'PENDING_APPROVAL', categories: ['anxiety'], profile: everything });
  await createTherapist({ fullName: 'נסתרת מושעית', status: 'SUSPENDED', categories: ['anxiety'], profile: everything });
  await createTherapist({ fullName: 'נסתרת כבויה', visible: false, categories: ['anxiety'], profile: everything });
});

describe('single filters', () => {
  it('has the whole directory when no filter is set (hidden people excluded)', async () => {
    expect(await search('')).toEqual(expected(() => true));
  });

  it.each<[string, string, (p: Person) => boolean]>([
    ['gender=FEMALE', 'gender=FEMALE', (p) => p.gender === 'FEMALE'],
    ['gender=MALE', 'gender=MALE', (p) => p.gender === 'MALE'],
    ['region=NORTH', 'region=NORTH', (p) => p.region === 'NORTH'],
    ['region=CENTER', 'region=CENTER', (p) => p.region === 'CENTER'],
    ['region=ONLINE_ONLY (nobody)', 'region=ONLINE_ONLY', () => false],
    ['online=true', 'online=true', (p) => p.online],
    ['audience=CHILDREN', 'audience=CHILDREN', (p) => p.audiences.includes('CHILDREN')],
    ['audience=PARENTS', 'audience=PARENTS', (p) => p.audiences.includes('PARENTS')],
    ['category=trauma', 'category=trauma', (p) => p.categories.includes('trauma')],
  ])('%s', async (_label, qs, predicate) => {
    expect(await search(qs)).toEqual(expected(predicate));
  });

  it('city matches part of the name and ignores letter case', async () => {
    expect(await search(`city=${encodeURIComponent('חיפה')}`)).toEqual(['אורי', 'בתיה']);
    expect(await search(`city=${encodeURIComponent('אביב')}`)).toEqual(['גילה']);
    expect(await search('city=haifa')).toEqual(['Hannah']);
    expect(await search('city=HAIFA')).toEqual(['Hannah']);
  });

  it('a person who left a field empty is simply not matched by that filter', async () => {
    for (const qs of ['gender=FEMALE', 'gender=MALE', 'region=NORTH', 'region=CENTER', 'online=true', 'audience=ADULTS']) {
      expect(await search(qs)).not.toContain('זיו');
    }
  });
});

describe('several values of one filter widen the result (OR)', () => {
  it('audience: any of the selected audiences', async () => {
    expect(await search('audience=TEENS,COUPLES')).toEqual(expected((p) => p.audiences.some((a) => a === 'TEENS' || a === 'COUPLES')));
  });

  it('category: any of the selected categories', async () => {
    expect(await search('category=trauma,youth')).toEqual(expected((p) => p.categories.some((c) => c === 'trauma' || c === 'youth')));
  });

  it('accepts "a,b" and repeated parameters identically', async () => {
    expect(await search('audience=TEENS&audience=COUPLES')).toEqual(await search('audience=TEENS,COUPLES'));
    expect(await search('category=trauma&category=youth')).toEqual(await search('category=trauma,youth'));
  });
});

describe('different filters narrow each other (AND)', () => {
  it('region + gender', async () => {
    expect(await search('region=NORTH&gender=FEMALE')).toEqual(expected((p) => p.region === 'NORTH' && p.gender === 'FEMALE'));
  });

  it('region + gender + audience', async () => {
    expect(await search('region=NORTH&gender=FEMALE&audience=ADULTS')).toEqual(
      expected((p) => p.region === 'NORTH' && p.gender === 'FEMALE' && p.audiences.includes('ADULTS')),
    );
  });

  it('online + gender + category (any of)', async () => {
    expect(await search('online=true&gender=FEMALE&category=anxiety,trauma')).toEqual(
      expected((p) => p.online && p.gender === 'FEMALE' && p.categories.some((c) => c === 'anxiety' || c === 'trauma')),
    );
  });

  it('keyword + category + region', async () => {
    expect(await search(`q=${encodeURIComponent('בתיה')}&category=trauma&region=NORTH`)).toEqual(['בתיה']);
    expect(await search(`q=${encodeURIComponent('בתיה')}&category=anxiety&region=NORTH`)).toEqual([]);
  });

  it('every filter at once, including contradictions, still gives exactly the right people', async () => {
    expect(await search('gender=MALE&region=SOUTH')).toEqual([]);
    expect(await search('gender=FEMALE&region=NORTH&city=haifa&audience=ADULTS&online=false&category=anxiety')).toEqual(['Hannah']);
  });
});

describe('hidden people never match', () => {
  it.each([
    'gender=FEMALE&region=NORTH&city=' + encodeURIComponent('חיפה') + '&audience=TEENS&online=true&category=anxiety',
    'gender=FEMALE',
    'region=NORTH',
    'online=true',
    'audience=TEENS',
    'category=anxiety',
    'q=' + encodeURIComponent('נסתרת'),
  ])('%s', async (qs) => {
    expect((await search(qs)).filter((n) => n.startsWith('נסתרת'))).toEqual([]);
  });
});

describe('parameter handling', () => {
  it('treats online=false, online=0 and blank values as "no filter"', async () => {
    const everyone = expected(() => true);
    expect(await search('online=false')).toEqual(everyone);
    expect(await search('online=0')).toEqual(everyone);
    expect(await search('gender=&region=&city=&audience=&category=')).toEqual(everyone);
  });

  it('accepts online=1', async () => {
    expect(await search('online=1')).toEqual(expected((p) => p.online));
  });

  it('returns nothing for an unknown category, and ignores an unknown one next to a known one', async () => {
    expect(await search('category=does-not-exist')).toEqual([]);
    expect(await search('category=trauma,does-not-exist')).toEqual(await search('category=trauma'));
  });

  it.each(['gender=ALIEN', 'region=MARS', 'audience=ROBOTS', 'audience=TEENS,ROBOTS', 'online=maybe', 'limit=500'])('rejects %s with 400', async (qs) => {
    expect((await api().get(`/api/therapists?${qs}`)).status).toBe(400);
  });

  it('treats regex characters in text filters as plain text', async () => {
    expect(await search(`city=${encodeURIComponent('.*')}`)).toEqual([]);
    expect(await search(`q=${encodeURIComponent('(((')}`)).toEqual([]);
  });

  it('paginates within a filter: totals are exact and no one appears twice', async () => {
    const want = expected((p) => p.audiences.includes('ADULTS'));
    const seen: string[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await api().get(`/api/therapists?limit=2&page=${page}&audience=ADULTS`);
      expect(res.body.total).toBe(want.length);
      totalPages = res.body.totalPages;
      seen.push(...res.body.items.map((i: { fullName: string }) => i.fullName));
      page += 1;
    } while (page <= totalPages);

    expect(totalPages).toBe(Math.ceil(want.length / 2));
    expect([...seen].sort()).toEqual(want);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
