import type { Gender, Region, TargetAudience, TherapistSearchParams } from '../types';

export const REGION_VALUES: Region[] = ['NORTH', 'CENTER', 'JERUSALEM', 'SOUTH', 'ONLINE_ONLY'];
export const GENDER_VALUES: Gender[] = ['MALE', 'FEMALE'];
export const AUDIENCE_VALUES: TargetAudience[] = ['CHILDREN', 'TEENS', 'ADULTS', 'COUPLES', 'PARENTS'];

/** Everything the search page can filter by. The URL is the single source of truth, so searches can be shared and bookmarked. */
export interface SearchFilters {
  q: string;
  categories: string[];
  gender: Gender | '';
  region: Region | '';
  city: string;
  audiences: TargetAudience[];
  online: boolean;
  page: number;
}

const csv = (value: string | null): string[] =>
  value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

const isAudience = (value: string): value is TargetAudience => AUDIENCE_VALUES.some((a) => a === value);

/** Reads the URL. Unknown or tampered values are ignored instead of breaking the page. */
export function parseFilters(params: URLSearchParams): SearchFilters {
  const gender = params.get('gender');
  const region = params.get('region');
  return {
    q: params.get('q') ?? '',
    categories: csv(params.get('category')),
    gender: GENDER_VALUES.find((g) => g === gender) ?? '',
    region: REGION_VALUES.find((r) => r === region) ?? '',
    city: params.get('city') ?? '',
    audiences: csv(params.get('audience')).filter(isAudience),
    online: params.get('online') === '1',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
}

/** Builds a short, readable URL: only the filters that are actually set. */
export function toSearchParams(f: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.categories.length) params.set('category', f.categories.join(','));
  if (f.gender) params.set('gender', f.gender);
  if (f.region) params.set('region', f.region);
  if (f.city) params.set('city', f.city);
  if (f.audiences.length) params.set('audience', f.audiences.join(','));
  if (f.online) params.set('online', '1');
  if (f.page > 1) params.set('page', String(f.page));
  return params;
}

export function toApiParams(f: SearchFilters): TherapistSearchParams {
  return {
    q: f.q || undefined,
    category: f.categories.length ? f.categories.join(',') : undefined,
    gender: f.gender || undefined,
    region: f.region || undefined,
    city: f.city || undefined,
    audience: f.audiences.length ? f.audiences.join(',') : undefined,
    online: f.online || undefined,
    page: f.page,
  };
}

/** Number of selected options in the sidebar (the keyword box is separate). */
export function countActiveFilters(f: SearchFilters): number {
  return f.categories.length + f.audiences.length + (f.gender ? 1 : 0) + (f.region ? 1 : 0) + (f.city ? 1 : 0) + (f.online ? 1 : 0);
}

export const toggleItem = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
