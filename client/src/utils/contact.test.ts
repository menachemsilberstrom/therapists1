import { describe, expect, it } from 'vitest';
import { AUDIENCE_VALUES, GENDER_VALUES, REGION_VALUES } from './searchFilters';
import { AUDIENCE_LABELS, GENDER_LABELS, REGION_LABELS, toTelUrl, toWhatsAppUrl } from './contact';

describe('toWhatsAppUrl', () => {
  it.each([
    ['050-1234567', 'https://wa.me/972501234567'], //          Israeli mobile with a leading 0
    ['0501234567', 'https://wa.me/972501234567'],
    ['050 123 4567', 'https://wa.me/972501234567'],
    ['+972 50-123-4567', 'https://wa.me/972501234567'], //     already international
    ['972501234567', 'https://wa.me/972501234567'],
    ['(050) 123-4567', 'https://wa.me/972501234567'],
  ])('%s -> %s', (phone, expected) => {
    expect(toWhatsAppUrl(phone)).toBe(expected);
  });
});

describe('toTelUrl', () => {
  it('keeps only digits and a leading +', () => {
    expect(toTelUrl('050-123 4567')).toBe('tel:0501234567');
    expect(toTelUrl('+972 (50) 123-4567')).toBe('tel:+972501234567');
  });
});

describe('labels', () => {
  it('has a Hebrew label for every region, audience and gender the filters can use', () => {
    for (const r of REGION_VALUES) expect(REGION_LABELS[r]).toBeTruthy();
    for (const a of AUDIENCE_VALUES) expect(AUDIENCE_LABELS[a]).toBeTruthy();
    for (const g of GENDER_VALUES) expect(GENDER_LABELS[g]).toBeTruthy();
  });
});
