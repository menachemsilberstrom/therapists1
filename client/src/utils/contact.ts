import type { Gender, Region, TargetAudience } from '../types';

export const REGION_LABELS: Record<Region, string> = {
  NORTH: 'צפון',
  CENTER: 'מרכז',
  JERUSALEM: 'ירושלים',
  SOUTH: 'דרום',
  ONLINE_ONLY: 'אונליין בלבד',
};

export function toTelUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Israeli numbers starting with 0 are converted to the international 972 format that wa.me requires. */
export function toWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const international = digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

export const AUDIENCE_LABELS: Record<TargetAudience, string> = {
  CHILDREN: 'ילדים',
  TEENS: 'בני נוער',
  ADULTS: 'מבוגרים',
  COUPLES: 'זוגות',
  PARENTS: 'הורים',
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'מטפל (גבר)',
  FEMALE: 'מטפלת (אישה)',
};
