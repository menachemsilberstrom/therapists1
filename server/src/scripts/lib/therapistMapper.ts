import type { Gender, Region, TargetAudience } from '../../models/TherapistProfile.js';
import type { DocxTable } from './docxTables.js';

/** A therapist ready to be written to MongoDB (category slugs are resolved to ids by the seed script). */
export interface SeedTherapist {
  /** Stable identity (normalised name). Used for de-duplication and for idempotent re-runs. */
  key: string;
  fullName: string;
  professionalTitle: string;
  gender?: Gender;
  bio: string;
  city: string;
  region: Region;
  acceptsOnline: boolean;
  targetAudiences: TargetAudience[];
  categorySlugs: string[];
  phone: string;
  whatsapp?: string;
  email?: string;
}

export interface MapStats {
  tables: number;
  rowsRead: number;
  blankRows: number;
  organisationRows: number;
  duplicatesMerged: number;
  unknownRegionTables: number;
  therapists: number;
}

// Column order in the source document.
const COL = { name: 0, profession: 1, places: 2, specialty: 3, audience: 4, contact: 5 } as const;

const REGION_BY_HEADING: ReadonlyArray<readonly [RegExp, Region]> = [
  [/צפון/, 'NORTH'],
  [/דרום/, 'SOUTH'],
  [/ירושלים/, 'JERUSALEM'],
  [/מרכז/, 'CENTER'],
];

const CATEGORY_RULES: ReadonlyArray<readonly [slug: string, pattern: RegExp]> = [
  ['anxiety', /חרד|ocd/i],
  ['depression', /די?כאון/],
  ['couples-therapy', /זוג/],
  ['family-therapy', /משפח/],
  ['child-therapy', /ילד|גיל הרך/],
  ['youth', /נוער|מתבגר|נערות|נערים/],
  ['trauma', /טראומ|ptsd|emdr|נפגע|פוגע|פגיעות מיניות|פגיעה מינית|התעללות/i],
  ['parenting', /הורים|הורות/],
  ['grief', /אובדן|תהליכי אבל|אבלים/],
  ['eating-disorders', /אכילה/],
  ['addictions', /התמכר/],
  ['adhd', /קשב|adhd/i],
];

const AUDIENCE_RULES: ReadonlyArray<readonly [TargetAudience, RegExp]> = [
  ['CHILDREN', /ילד|גיל הרך/],
  ['TEENS', /נוער|מתבגר|נערות|נערים/],
  ['ADULTS', /מבוגר|בוגר|נשים|גברים|יחידים|בחורות|18/],
  ['COUPLES', /זוג/],
  ['PARENTS', /הורים|הורות/],
];

const ONLINE_PATTERN = /זום|מקוון|אונליין|online|zoom/i;
const MAX_TITLE_LENGTH = 100;
const MAX_BIO_LENGTH = 3000;

const clean = (s: string): string => s.replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
/** Drops dangling separators the document leaves at line ends ("מטפלת," / "טיפול זוגי.") so lines join cleanly. */
const tidyLine = (s: string): string =>
  s.replace(/[\s,;:–-]+$/, '').replace(/(?<=[֐-׿)])\.+$/, '');
const lines = (cell: string | undefined): string[] =>
  (cell ?? '')
    .split('\n')
    .map(clean)
    .map(tidyLine)
    .filter(Boolean);
/** Cuts at a word boundary (when one is reasonably close) and appends an ellipsis. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd().replace(/[,;:.\-–]+$/, '')}…`;
}
const unique = <T>(items: T[]): T[] => [...new Set(items)];

/** "זקס, שלמה" -> "שלמה זקס"; keeps only the first line (some cells add an English spelling below). */
function parseName(cell: string | undefined): string {
  const first = lines(cell)[0] ?? '';
  const swapped = /^([^,]+),\s*([^,]+)$/.exec(first);
  return clean(swapped ? `${swapped[2]} ${swapped[1]}` : first);
}

/** Identity key: ignores spacing, quotes and punctuation so "ד"ר X" and "ד״ר X" match. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[\s"'`״׳”“.,\-]/g, '');
}

// Note: JS `\b` only knows ASCII word characters, so it can't be used with Hebrew; match a space/end instead.
const isOrganisation = (name: string): boolean => /^מרכז(?:\s|$)/.test(name);

function inferGender(title: string): Gender | undefined {
  const feminine = /מטפלת|פסיכולוגית|פסיכותרפיסטית|דוקטורנטית|עובדת|מדריכה|יועצת|קלינית/.test(title);
  const masculine = /מטפל(?![תי])|פסיכולוג(?![ית])|פסיכותרפיסט(?![ית])|קליני(?!ת)/.test(title);
  if (feminine && !masculine) return 'FEMALE';
  if (masculine && !feminine) return 'MALE';
  return undefined; // ambiguous or not stated (e.g. "MSW") - left unset rather than guessed
}

interface Contact {
  phone: string;
  whatsapp?: string;
  email?: string;
}

function parseContact(cell: string | undefined): Contact {
  const text = cell ?? '';
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.exec(text)?.[0].toLowerCase();

  let phone = '';
  let whatsapp: string | undefined;
  for (const piece of text.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ').split(/[\n/]/)) {
    let digits = piece.replace(/\D/g, '');
    if (digits.startsWith('972')) digits = `0${digits.slice(3)}`;
    if (!/^0\d{8,9}$/.test(digits)) continue;
    phone = digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
    if (/^05\d{8}$/.test(digits)) whatsapp = digits; // only valid mobile numbers can receive WhatsApp
    break; // first valid number is the primary one
  }
  return { phone, whatsapp, email };
}

interface Places {
  cities: string[];
  online: boolean;
}

function parsePlaces(cell: string | undefined): Places {
  const raw = cell ?? '';
  const online = ONLINE_PATTERN.test(raw);
  const cities = unique(
    raw
      .replace(/ו?(?:ב)?זום|באופן מקוון|ו?מקוון|ו?אונליין/gi, ' ')
      .replace(/(^|\s)טיפול\s*\.?\s*(?=\(|$)/gm, ' ') // "טיפול בזום." leaves a dangling "טיפול ." once "בזום" is removed
      .split(/[\n,/]/)
      .map((c) => tidyLine(clean(c)).replace(/\s+או$/, '').trim())
      .filter((c) => c && !/^(והסביבה|הסביבה)$/.test(c)),
  );
  return { cities, online };
}

function matchingSlugs(text: string): string[] {
  return CATEGORY_RULES.filter(([, pattern]) => pattern.test(text)).map(([slug]) => slug);
}

function matchingAudiences(text: string): TargetAudience[] {
  return AUDIENCE_RULES.filter(([, pattern]) => pattern.test(text)).map(([audience]) => audience);
}

interface Draft {
  fullName: string;
  titleLines: string[];
  specialtyLines: string[];
  audienceLines: string[];
  cities: string[];
  online: boolean;
  region: Region;
  contact: Contact;
}

function buildBio(d: Draft): string {
  const parts: string[] = [];
  if (d.specialtyLines.length) parts.push(`התמחות: ${d.specialtyLines.join('; ')}`);
  if (d.audienceLines.length) parts.push(`קהל יעד: ${d.audienceLines.join(', ')}`);
  const places = [...d.cities, ...(d.online ? ['זום'] : [])];
  if (places.length) parts.push(`מקום קבלה: ${places.join(', ')}`);
  // The profile already shows the professional title, so it is not repeated in the bio. Only when the title was
  // too long for the title field (and got cut) is the full text kept, last, so cards still lead with the specialties.
  const fullTitle = d.titleLines.join(', ');
  if (fullTitle.length > MAX_TITLE_LENGTH) parts.push(`מקצוע והכשרה (מלא): ${fullTitle}`);
  return truncate(parts.join('\n\n'), MAX_BIO_LENGTH);
}

function finalize(key: string, d: Draft): SeedTherapist {
  const text = [...d.titleLines, ...d.specialtyLines, ...d.audienceLines].join('\n');
  return {
    key,
    fullName: d.fullName,
    professionalTitle: truncate(d.titleLines.join(', '), MAX_TITLE_LENGTH),
    gender: inferGender(d.titleLines.join(' ')),
    bio: buildBio(d),
    city: truncate(d.cities[0] ?? '', MAX_TITLE_LENGTH),
    region: d.region,
    acceptsOnline: d.online,
    targetAudiences: matchingAudiences(text),
    categorySlugs: matchingSlugs(text).slice(0, 10),
    phone: d.contact.phone,
    whatsapp: d.contact.whatsapp,
    email: d.contact.email,
  };
}

/** Maps the regional tables of the directory document to therapists (de-duplicated across regions). */
export function mapTablesToTherapists(tables: DocxTable[]): { therapists: SeedTherapist[]; stats: MapStats } {
  const stats: MapStats = {
    tables: tables.length,
    rowsRead: 0,
    blankRows: 0,
    organisationRows: 0,
    duplicatesMerged: 0,
    unknownRegionTables: 0,
    therapists: 0,
  };
  const drafts = new Map<string, Draft>();

  for (const table of tables) {
    const region = REGION_BY_HEADING.find(([pattern]) => pattern.test(table.heading))?.[1];
    if (!region) {
      stats.unknownRegionTables += 1;
      continue;
    }

    for (const row of table.rows) {
      if (/שם/.test(row[COL.name] ?? '') && /מקצוע/.test(row[COL.profession] ?? '')) continue; // header row
      stats.rowsRead += 1;

      const fullName = parseName(row[COL.name]);
      if (!fullName) {
        stats.blankRows += 1;
        continue;
      }
      if (isOrganisation(fullName)) {
        stats.organisationRows += 1; // a clinic/centre, not an individual therapist
        continue;
      }

      const places = parsePlaces(row[COL.places]);
      const key = nameKey(fullName);
      const existing = drafts.get(key);

      if (existing) {
        // Same therapist listed under another region: keep the first region, add the extra places.
        stats.duplicatesMerged += 1;
        existing.cities = unique([...existing.cities, ...places.cities]);
        existing.online ||= places.online;
        existing.contact.phone ||= parseContact(row[COL.contact]).phone;
        continue;
      }

      drafts.set(key, {
        fullName,
        titleLines: lines(row[COL.profession]),
        specialtyLines: lines(row[COL.specialty]),
        audienceLines: lines(row[COL.audience]).map((l) => l.replace(/\s+asd\b/gi, '')),
        cities: places.cities,
        online: places.online,
        region,
        contact: parseContact(row[COL.contact]),
      });
    }
  }

  const therapists = [...drafts].map(([key, draft]) => finalize(key, draft));
  stats.therapists = therapists.length;
  return { therapists, stats };
}
