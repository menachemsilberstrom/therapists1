import type { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { certificateFileType, mimeFromKey, toAdminDetail } from '../../src/utils/adminDto.js';
import { makeSnippet, toCardDto, toOwnProfileDto, toProfileDto, type LeanProfile } from '../../src/utils/profileDto.js';
import { escapeRegex } from '../../src/utils/regex.js';

const oid = (hex: string) => ({ toString: () => hex }) as unknown as Types.ObjectId;

/** A profile exactly as the database returns it, including every private field. */
const sensitiveProfile = (): LeanProfile => ({
  _id: oid('aaaaaaaaaaaaaaaaaaaaaaaa'),
  userId: oid('bbbbbbbbbbbbbbbbbbbbbbbb'),
  slug: 'dana-123456',
  fullName: 'דנה',
  professionalTitle: 'פסיכולוגית',
  gender: 'FEMALE',
  bio: 'ביו',
  city: 'חיפה',
  region: 'NORTH',
  acceptsOnline: true,
  targetAudiences: ['ADULTS'],
  categories: [{ _id: oid('cccccccccccccccccccccccc'), name: 'חרדה', slug: 'anxiety' }],
  contactInfo: { phone: '050-1111111' },
  certificates: [
    { _id: oid('dddddddddddddddddddddddd'), title: 'תואר', fileUrl: 'certificates/SECRET-KEY.pdf', originalName: 'x.pdf', uploadedAt: new Date(0), isVerified: true },
  ] as unknown as LeanProfile['certificates'],
  isPubliclyVisible: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe('escapeRegex', () => {
  it('escapes every regex special character so user text is matched literally', () => {
    const input = '.*+?^${}()|[]\\';
    const rx = new RegExp(escapeRegex(input));
    expect(rx.test(input)).toBe(true);
    expect(escapeRegex('a.b')).toBe('a\\.b');
  });

  it('prevents ".*" from matching everything', () => {
    expect(new RegExp(escapeRegex('.*')).test('anything at all')).toBe(false);
  });

  it('leaves Hebrew and plain text untouched', () => {
    expect(escapeRegex('דנה כהן')).toBe('דנה כהן');
  });
});

describe('makeSnippet (the teaser on directory cards)', () => {
  it('returns short text unchanged', () => {
    expect(makeSnippet('ביו קצר')).toBe('ביו קצר');
  });

  it('uses only the first paragraph and collapses whitespace', () => {
    expect(makeSnippet('שורה   ראשונה\nעוד  מילים\n\nפסקה שנייה')).toBe('שורה ראשונה עוד מילים');
  });

  it('cuts long text at a word boundary and adds an ellipsis', () => {
    const long = Array.from({ length: 80 }, (_, i) => `מילה${i}`).join(' ');
    const snippet = makeSnippet(long);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(161);
    const lastWord = snippet.slice(0, -1).split(' ').at(-1) as string;
    expect(long.split(' ')).toContain(lastWord); // never a half word
  });

  it('copes with empty text', () => {
    expect(makeSnippet('')).toBe('');
  });
});

describe('response DTOs never leak private data', () => {
  it('the public profile has no account id, e-mail or certificate files, only the verified flag', () => {
    const dto = toProfileDto(sensitiveProfile());
    const text = JSON.stringify(dto);
    expect(dto).not.toHaveProperty('userId');
    expect(dto).not.toHaveProperty('certificates');
    expect(text).not.toContain('SECRET-KEY');
    expect(text).not.toContain('bbbbbbbbbbbbbbbbbbbbbbbb');
    expect(dto.hasVerifiedCertificates).toBe(true);
  });

  it('the directory card is even smaller: no contact details, no full bio', () => {
    const card = toCardDto(sensitiveProfile());
    for (const key of ['userId', 'contactInfo', 'certificates', 'bio', 'gender', 'isPubliclyVisible']) expect(card).not.toHaveProperty(key);
  });

  it('the owner view includes certificate titles and status but never the storage key', () => {
    const dto = toOwnProfileDto(sensitiveProfile(), 'ACTIVE');
    expect(dto.certificates).toEqual([{ id: 'dddddddddddddddddddddddd', title: 'תואר', originalName: 'x.pdf', uploadedAt: new Date(0), isVerified: true }]);
    expect(JSON.stringify(dto)).not.toContain('SECRET-KEY');
    expect(dto.accountStatus).toBe('ACTIVE');
  });

  it('the admin view exposes the file TYPE of a certificate, never its path', () => {
    const user = { _id: oid('bbbbbbbbbbbbbbbbbbbbbbbb'), email: 'dana@example.com', status: 'ACTIVE' as const, createdAt: new Date(0) };
    const detail = toAdminDetail(user, sensitiveProfile());
    expect(detail.certificates[0]).toMatchObject({ fileType: 'pdf', title: 'תואר' });
    expect(JSON.stringify(detail)).not.toContain('SECRET-KEY');
  });

  it('the admin view copes with an account that has no profile', () => {
    const user = { _id: oid('bbbbbbbbbbbbbbbbbbbbbbbb'), email: 'orphan@example.com', status: 'PENDING_APPROVAL' as const, createdAt: new Date(0) };
    const detail = toAdminDetail(user, null);
    expect(detail).toMatchObject({ hasProfile: false, fullName: '', certificates: [], categories: [], isPubliclyVisible: false });
  });
});

describe('certificate file helpers', () => {
  it('derives the file type and content type from the storage key', () => {
    expect(certificateFileType('certificates/a/b.pdf')).toBe('pdf');
    expect(certificateFileType('certificates/a/b.PNG')).toBe('image');
    expect(mimeFromKey('x.pdf')).toBe('application/pdf');
    expect(mimeFromKey('x.jpg')).toBe('image/jpeg');
    expect(mimeFromKey('x.webp')).toBe('image/webp');
    expect(mimeFromKey('x.exe')).toBe('application/octet-stream');
  });
});
