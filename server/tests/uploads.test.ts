import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import type { Response } from 'superagent';
import { beforeEach, describe, expect, it } from 'vitest';
import { TherapistProfile } from '../src/models/TherapistProfile.js';
import { api, bearer, createAdmin, createTherapist, jpegWithExif, pdfBuffer, pngBuffer, resetDb, uploadedFileCount } from './helpers.js';

/** Collects a binary response body (images, PDFs) into a Buffer. */
function binary(res: Response, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

let therapist: Awaited<ReturnType<typeof createTherapist>>;
let admin: Awaited<ReturnType<typeof createAdmin>>;

beforeEach(async () => {
  await resetDb();
  await rm(process.env.UPLOADS_DIR as string, { recursive: true, force: true });
  therapist = await createTherapist({ fullName: 'דנה כהן' });
  admin = await createAdmin();
});

const uploadAvatar = (data: Buffer, filename = 'photo.png', contentType = 'image/png', field = 'avatar') =>
  api().post('/api/therapists/me/avatar').set(bearer(therapist.token)).attach(field, data, { filename, contentType });

const uploadCertificate = (title: string | undefined, data: Buffer, filename = 'תעודה.pdf', contentType = 'application/pdf') => {
  const req = api().post('/api/therapists/me/certificates').set(bearer(therapist.token));
  if (title !== undefined) req.field('title', title);
  return req.attach('certificate', data, { filename, contentType });
};

describe('avatar upload', () => {
  it('stores a square 512px WebP, publishes it at /uploads and returns the new profile', async () => {
    const res = await uploadAvatar(await pngBuffer(1000, 600));
    expect(res.status).toBe(200);
    expect(res.body.profileImageUrl).toMatch(/^\/uploads\/avatars\/[0-9a-f]{24}-[0-9a-f]{12}\.webp$/);

    const image = await api().get(res.body.profileImageUrl as string).buffer(true).parse(binary);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');
    const meta = await sharp(image.body as Buffer).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([512, 512, 'webp']);
  });

  it('serves avatars with long-lived caching and a cross-origin policy that lets the website show them', async () => {
    const res = await uploadAvatar(await pngBuffer());
    const image = await api().get(res.body.profileImageUrl as string);
    expect(image.headers['cache-control']).toMatch(/immutable/);
    expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('strips EXIF metadata such as GPS and device information', async () => {
    const original = await jpegWithExif();
    expect((await sharp(original).metadata()).exif).toBeDefined(); // the fixture really has EXIF
    const res = await uploadAvatar(original, 'photo.jpg', 'image/jpeg');
    const image = await api().get(res.body.profileImageUrl as string).buffer(true).parse(binary);
    expect((await sharp(image.body as Buffer).metadata()).exif).toBeUndefined();
    expect((image.body as Buffer).includes('SECRET-EXIF-MARKER')).toBe(false);
  });

  it('replaces the previous picture: new URL, old file deleted', async () => {
    const first = await uploadAvatar(await pngBuffer());
    const second = await uploadAvatar(await pngBuffer(400, 400));
    expect(second.body.profileImageUrl).not.toBe(first.body.profileImageUrl);
    expect((await api().get(first.body.profileImageUrl as string)).status).toBe(404);
    expect((await api().get(second.body.profileImageUrl as string)).status).toBe(200);
    expect(uploadedFileCount()).toBe(1);
  });

  it('can be removed again', async () => {
    const up = await uploadAvatar(await pngBuffer());
    const res = await api().delete('/api/therapists/me/avatar').set(bearer(therapist.token));
    expect(res.status).toBe(200);
    expect(res.body.profileImageUrl).toBeUndefined();
    expect((await api().get(up.body.profileImageUrl as string)).status).toBe(404);
    expect(uploadedFileCount()).toBe(0);
  });

  it.each([
    ['a text file pretending to be a PNG', () => Buffer.from('this is plain text, not an image'), 'fake.png', 'image/png', 'FILE_TYPE_INVALID'],
    ['a PDF', () => pdfBuffer(), 'doc.pdf', 'application/pdf', 'FILE_TYPE_INVALID'],
    ['a disallowed content type', () => Buffer.from('GIF89a'), 'a.gif', 'image/gif', 'FILE_TYPE_INVALID'],
    ['a corrupt image with a valid PNG signature', () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]), 'broken.png', 'image/png', 'IMAGE_INVALID'],
  ])('rejects %s with 400', async (_label, make, filename, contentType, code) => {
    const res = await uploadAvatar(make(), filename, contentType);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
    expect(uploadedFileCount()).toBe(0);
  });

  it('rejects a file over 5 MB', async () => {
    const huge = Buffer.concat([await pngBuffer(), Buffer.alloc(6 * 1024 * 1024)]);
    const res = await uploadAvatar(huge);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects the wrong form field name and a request with no file', async () => {
    expect((await uploadAvatar(await pngBuffer(), 'a.png', 'image/png', 'wrongfield')).body.code).toBe('FILE_FIELD_INVALID');
    const none = await api().post('/api/therapists/me/avatar').set(bearer(therapist.token)).field('x', 'y');
    expect(none.body.code).toBe('FILE_MISSING');
  });

  it('is refused for anonymous visitors and admins without writing anything', async () => {
    const png = await pngBuffer();
    const anon = await api().post('/api/therapists/me/avatar').attach('avatar', png, { filename: 'a.png', contentType: 'image/png' });
    expect(anon.status).toBe(401);
    const asAdmin = await api().post('/api/therapists/me/avatar').set(bearer(admin.token)).attach('avatar', png, { filename: 'a.png', contentType: 'image/png' });
    expect(asAdmin.status).toBe(403);
    expect(uploadedFileCount()).toBe(0);
  });
});

describe('certificate upload (private)', () => {
  it('stores a certificate privately and shows the owner only its title, name and status', async () => {
    const res = await uploadCertificate('תואר שני בעבודה סוציאלית', pdfBuffer());
    expect(res.status).toBe(201);
    expect(res.body.certificates).toHaveLength(1);
    expect(res.body.certificates[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      title: 'תואר שני בעבודה סוציאלית',
      originalName: 'תעודה.pdf', // the Hebrew file name survives the upload
      uploadedAt: expect.any(String),
      isVerified: false,
    });
    expect(JSON.stringify(res.body)).not.toContain('certificates/'); // no storage path anywhere
    expect(res.body.certificates[0]).not.toHaveProperty('fileUrl');
    expect(uploadedFileCount()).toBe(1);
  });

  it('is never reachable through the public /uploads route', async () => {
    await uploadCertificate('תעודה', pdfBuffer());
    const profile = await TherapistProfile.findById(therapist.profileId);
    const key = profile?.certificates[0]?.fileUrl as string;
    expect(key).toMatch(/^certificates\/[0-9a-f]{24}\/[0-9a-f-]{36}\.pdf$/);
    expect((await api().get(`/uploads/${key}`)).status).toBe(404);
    expect((await api().get(`/uploads/${encodeURIComponent('../private/' + key)}`)).status).not.toBe(200);
  });

  it('does not appear on the public profile', async () => {
    await uploadCertificate('תעודה סודית', pdfBuffer());
    const res = await api().get(`/api/therapists/${encodeURIComponent(therapist.slug as string)}`);
    expect(JSON.stringify(res.body)).not.toContain('תעודה סודית');
    expect(res.body.hasVerifiedCertificates).toBe(false);
  });

  it('accepts a PDF', async () => {
    expect((await uploadCertificate('תעודה', pdfBuffer(), 'a.pdf', 'application/pdf')).status).toBe(201);
  });

  it('accepts an image certificate', async () => {
    expect((await uploadCertificate('תעודה', await pngBuffer(), 'scan.png', 'image/png')).status).toBe(201);
  });

  it('rejects a missing or too-short title before storing anything', async () => {
    expect((await uploadCertificate(undefined, pdfBuffer())).status).toBe(400);
    expect((await uploadCertificate('א', pdfBuffer())).status).toBe(400);
    expect(uploadedFileCount()).toBe(0);
  });

  it('rejects a file whose real content is not a PDF or an image', async () => {
    const res = await uploadCertificate('תעודה', Buffer.from('MZ\x90\x00 an executable pretending to be a pdf'), 'virus.pdf', 'application/pdf');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_TYPE_INVALID');
    expect(uploadedFileCount()).toBe(0);
  });

  it('allows at most 10 certificates per therapist', async () => {
    for (let i = 0; i < 10; i += 1) expect((await uploadCertificate(`תעודה ${i + 1}`, pdfBuffer())).status).toBe(201);
    const eleventh = await uploadCertificate('תעודה 11', pdfBuffer());
    expect(eleventh.status).toBe(400);
    expect(eleventh.body.code).toBe('TOO_MANY_CERTIFICATES');
    expect(uploadedFileCount()).toBe(10);
  });

  it('can be deleted by its owner, which also removes the file', async () => {
    const added = await uploadCertificate('תעודה', pdfBuffer());
    const id = added.body.certificates[0].id as string;
    const res = await api().delete(`/api/therapists/me/certificates/${id}`).set(bearer(therapist.token));
    expect(res.status).toBe(200);
    expect(res.body.certificates).toEqual([]);
    expect(uploadedFileCount()).toBe(0);
    expect((await api().delete(`/api/therapists/me/certificates/${id}`).set(bearer(therapist.token))).status).toBe(404);
    expect((await api().delete('/api/therapists/me/certificates/not-an-id').set(bearer(therapist.token))).status).toBe(400);
  });

  it("cannot delete another therapist's certificate", async () => {
    const mine = await uploadCertificate('שלי', pdfBuffer());
    const id = mine.body.certificates[0].id as string;
    const other = await createTherapist({ fullName: 'אחר' });
    const res = await api().delete(`/api/therapists/me/certificates/${id}`).set(bearer(other.token));
    expect(res.status).toBe(404);
    expect(uploadedFileCount()).toBe(1);
  });
});

describe('admin access to private certificates', () => {
  async function upload() {
    const res = await uploadCertificate('תואר', pdfBuffer());
    return res.body.certificates[0].id as string;
  }

  it('lets an admin download the exact file, inline, never cached', async () => {
    const certId = await upload();
    const res = await api().get(`/api/admin/therapists/${therapist.userId}/certificates/${certId}/file`).set(bearer(admin.token)).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/^inline; filename\*=UTF-8''/);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect((res.body as Buffer).equals(pdfBuffer())).toBe(true);
  });

  it('refuses everyone else: anonymous, the owner, and other therapists', async () => {
    const certId = await upload();
    const url = `/api/admin/therapists/${therapist.userId}/certificates/${certId}/file`;
    expect((await api().get(url)).status).toBe(401);
    expect((await api().get(url).set(bearer(therapist.token))).status).toBe(403);
    const other = await createTherapist();
    expect((await api().get(url).set(bearer(other.token))).status).toBe(403);
  });

  it('answers 404 for an unknown certificate or one that belongs to someone else', async () => {
    const certId = await upload();
    const other = await createTherapist({ fullName: 'אחר' });
    expect((await api().get(`/api/admin/therapists/${therapist.userId}/certificates/${'a'.repeat(24)}/file`).set(bearer(admin.token))).status).toBe(404);
    expect((await api().get(`/api/admin/therapists/${other.userId}/certificates/${certId}/file`).set(bearer(admin.token))).status).toBe(404);
  });

  it('verifying a certificate turns on the public "certificates verified" flag, un-verifying turns it off', async () => {
    const certId = await upload();
    const url = `/api/admin/therapists/${therapist.userId}/certificates/${certId}`;
    const slug = encodeURIComponent(therapist.slug as string);

    const on = await api().patch(url).set(bearer(admin.token)).send({ isVerified: true });
    expect(on.status).toBe(200);
    expect(on.body).toMatchObject({ verifiedCertificateCount: 1, certificateCount: 1 });
    expect((await api().get(`/api/therapists/${slug}`)).body.hasVerifiedCertificates).toBe(true);

    await api().patch(url).set(bearer(admin.token)).send({ isVerified: false });
    expect((await api().get(`/api/therapists/${slug}`)).body.hasVerifiedCertificates).toBe(false);
    expect((await api().patch(url).set(bearer(admin.token)).send({ isVerified: 'yes' })).status).toBe(400);
  });

  it('deleting a therapist removes the avatar and every certificate file', async () => {
    await uploadAvatar(await pngBuffer());
    await uploadCertificate('אחת', pdfBuffer());
    await uploadCertificate('שתיים', pdfBuffer());
    expect(uploadedFileCount()).toBe(3);

    const res = await api().delete(`/api/admin/therapists/${therapist.userId}`).set(bearer(admin.token)).send({ confirmEmail: therapist.email });
    expect(res.status).toBe(200);
    expect(res.body.filesRemoved).toBe(3);
    expect(uploadedFileCount()).toBe(0);
  });
});
