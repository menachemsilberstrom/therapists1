import { describe, expect, it } from 'vitest';
import { countActiveFilters, parseFilters, toApiParams, toggleItem, toSearchParams, type SearchFilters } from './searchFilters';

const EMPTY: SearchFilters = { q: '', categories: [], gender: '', region: '', city: '', audiences: [], online: false, page: 1 };
const parse = (query: string) => parseFilters(new URLSearchParams(query));

describe('parseFilters (the URL is the source of truth)', () => {
  it('an empty URL means no filters, page 1', () => {
    expect(parse('')).toEqual(EMPTY);
  });

  it('reads every filter', () => {
    expect(parse('q=%D7%97%D7%A8%D7%93%D7%94&category=anxiety,trauma&gender=FEMALE&region=NORTH&city=Haifa&audience=TEENS,COUPLES&online=1&page=3')).toEqual({
      q: 'חרדה',
      categories: ['anxiety', 'trauma'],
      gender: 'FEMALE',
      region: 'NORTH',
      city: 'Haifa',
      audiences: ['TEENS', 'COUPLES'],
      online: true,
      page: 3,
    });
  });

  it('ignores unknown or tampered values instead of breaking', () => {
    expect(parse('gender=ALIEN&region=MARS&audience=ROBOTS,TEENS&online=maybe&page=abc')).toEqual({
      ...EMPTY,
      audiences: ['TEENS'], // the valid one is kept
    });
  });

  it.each([
    ['abc', 1],
    ['0', 1],
    ['-4', 1],
    ['', 1],
    ['2', 2],
  ])('page=%s -> %i', (value, expected) => {
    expect(parse(`page=${value}`).page).toBe(expected);
  });

  it('trims and drops empty entries in comma separated lists', () => {
    expect(parse('category=a,,b, c ,').categories).toEqual(['a', 'b', 'c']);
  });

  it('only online=1 turns the online filter on', () => {
    expect(parse('online=1').online).toBe(true);
    for (const v of ['true', '0', 'yes', '']) expect(parse(`online=${v}`).online).toBe(false);
  });
});

describe('toSearchParams', () => {
  it('writes only the filters that are set, and never page 1', () => {
    expect(toSearchParams(EMPTY).toString()).toBe('');
    expect(toSearchParams({ ...EMPTY, region: 'NORTH', online: true }).toString()).toBe('region=NORTH&online=1');
  });

  it('round-trips: parse(toSearchParams(f)) gives back f', () => {
    const full: SearchFilters = {
      q: 'דנה כהן',
      categories: ['anxiety', 'trauma'],
      gender: 'MALE',
      region: 'JERUSALEM',
      city: 'ירושלים',
      audiences: ['CHILDREN', 'PARENTS'],
      online: true,
      page: 4,
    };
    expect(parseFilters(toSearchParams(full))).toEqual(full);
    expect(parseFilters(toSearchParams(EMPTY))).toEqual(EMPTY);
  });
});

describe('toApiParams', () => {
  it('sends only what is set, with lists joined by commas', () => {
    expect(toApiParams(EMPTY)).toEqual({
      q: undefined,
      category: undefined,
      gender: undefined,
      region: undefined,
      city: undefined,
      audience: undefined,
      online: undefined,
      page: 1,
    });
    expect(toApiParams({ ...EMPTY, q: 'x', categories: ['a', 'b'], gender: 'FEMALE', region: 'CENTER', city: 'c', audiences: ['TEENS', 'ADULTS'], online: true, page: 2 })).toEqual({
      q: 'x',
      category: 'a,b',
      gender: 'FEMALE',
      region: 'CENTER',
      city: 'c',
      audience: 'TEENS,ADULTS',
      online: true,
      page: 2,
    });
  });
});

describe('countActiveFilters (the badge on the phone button)', () => {
  it('counts every selected option but not the keyword or the page', () => {
    expect(countActiveFilters(EMPTY)).toBe(0);
    expect(countActiveFilters({ ...EMPTY, q: 'hello', page: 5 })).toBe(0);
    expect(countActiveFilters({ ...EMPTY, categories: ['a', 'b'], gender: 'MALE', region: 'NORTH', city: 'x', audiences: ['TEENS'], online: true })).toBe(7);
  });
});

describe('toggleItem', () => {
  it('adds a missing item and removes a present one without changing the original', () => {
    const original = ['a', 'b'];
    expect(toggleItem(original, 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleItem(original, 'a')).toEqual(['b']);
    expect(original).toEqual(['a', 'b']);
  });
});
