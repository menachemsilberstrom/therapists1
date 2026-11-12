import { randomBytes, randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Category } from '../models/Category.js';
import { TherapistProfile, type ITherapistProfile } from '../models/TherapistProfile.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { processAvatar } from '../services/imageService.js';
import { storage } from '../storage/index.js';
import { detectFileType } from '../utils/fileType.js';
import {
  toCardDto,
  toOwnProfileDto,
  toProfileDto,
  type LeanProfile,
  type PopulatedCategory,
} from '../utils/profileDto.js';

const MAX_CERTIFICATES = 10;
const AVATAR_KEY_PREFIX = 'avatars/';

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(), // category slug
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

// Phone numbers: digits, spaces, +, -, ( )
const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[0-9+\-\s()]*$/, 'Invalid phone number');

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  professionalTitle: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(3000).optional(),
  city: z.string().trim().max(100).optional(),
  phone: phoneSchema.optional(),
  whatsapp: phoneSchema.optional(),
  contactEmail: z.union([z.string().trim().email(), z.literal('')]).optional(),
  categories: z.array(z.string().trim().min(1).max(100)).max(10).optional(), // category slugs
});

async function findLeanProfile(filter: QueryFilter<ITherapistProfile>): Promise<LeanProfile | null> {
  const profile = await TherapistProfile.findOne(filter)
    .populate<{ categories: PopulatedCategory[] }>('categories', 'name slug')
    .lean();
  return profile as unknown as LeanProfile | null;
}

/** GET /api/therapists - public search (text + category), visible profiles only. */
export const listTherapists: RequestHandler = async (req, res) => {
  const { q, category, page, limit } = listQuerySchema.parse(req.query);

  const filter: QueryFilter<ITherapistProfile> = {
    isPubliclyVisible: true,
    fullName: { $ne: '' }, // skip freshly registered, still-empty profiles
  };

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ fullName: rx }, { professionalTitle: rx }, { bio: rx }, { city: rx }];
  }

  if (category) {
    const cat = await Category.findOne({ slug: category, isActive: true }, '_id').lean();
    if (!cat) {
      res.json({ items: [], total: 0, page, limit, totalPages: 0 });
      return;
    }
    filter.categories = cat._id;
  }

  const [total, profiles] = await Promise.all([
    TherapistProfile.countDocuments(filter),
    TherapistProfile.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ categories: PopulatedCategory[] }>('categories', 'name slug')
      .lean(),
  ]);

  res.json({
    items: (profiles as unknown as LeanProfile[]).map(toCardDto),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
};

/** GET /api/therapists/:slug - public full profile. */
export const getTherapistBySlug: RequestHandler = async (req, res) => {
  const slug = req.params.slug;
  if (typeof slug !== 'string') throw new HttpError(400, 'Invalid slug');

  const profile = await findLeanProfile({ slug, isPubliclyVisible: true });
  if (!profile) throw new HttpError(404, 'Therapist not found');
  res.json(toProfileDto(profile));
};

/** GET /api/therapists/me - the logged-in therapist's own profile (for the dashboard form). */
export const getMyProfile: RequestHandler = async (req, res) => {
  const profile = await findLeanProfile({ userId: new Types.ObjectId(req.auth?.userId) });
  if (!profile) throw new HttpError(404, 'Profile not found');
  res.json(toOwnProfileDto(profile));
};

/** PUT /api/therapists/me - update own text fields. Only the fields that are sent are changed. */
export const updateMyProfile: RequestHandler = async (req, res) => {
  const data = updateSchema.parse(req.body);
  const userId = new Types.ObjectId(req.auth?.userId);

  const profile = await TherapistProfile.findOne({ userId });
  if (!profile) throw new HttpError(404, 'Profile not found');

  if (data.categories) {
    const slugs = [...new Set(data.categories)];
    const cats = await Category.find({ slug: { $in: slugs }, isActive: true }, '_id').lean();
    if (cats.length !== slugs.length) throw new HttpError(400, 'One or more categories do not exist');
    profile.categories = cats.map((c) => c._id);
  }

  if (data.fullName !== undefined) profile.fullName = data.fullName;
  if (data.professionalTitle !== undefined) profile.professionalTitle = data.professionalTitle;
  if (data.bio !== undefined) profile.bio = data.bio;
  if (data.city !== undefined) profile.city = data.city;
  if (data.phone !== undefined) profile.contactInfo.phone = data.phone;
  if (data.whatsapp !== undefined) profile.contactInfo.whatsapp = data.whatsapp;
  if (data.contactEmail !== undefined) profile.contactInfo.email = data.contactEmail;

  await profile.save();

  res.json(await loadOwnProfileDto(profile._id));
};

async function loadOwnProfileDto(profileId: Types.ObjectId) {
  const updated = await findLeanProfile({ _id: profileId });
  if (!updated) throw new HttpError(404, 'Profile not found');
  return toOwnProfileDto(updated);
}

async function findMyProfileDocument(userId: string | undefined) {
  const profile = await TherapistProfile.findOne({ userId: new Types.ObjectId(userId) });
  if (!profile) throw new HttpError(404, 'Profile not found');
  return profile;
}

/** Best-effort file removal: a leftover file must never turn a successful request into an error. */
async function removeQuietly(
  req: Parameters<RequestHandler>[0],
  access: 'public' | 'private',
  key: string,
): Promise<void> {
  try {
    await storage.remove(access, key);
  } catch (err) {
    req.log.warn({ err, key }, 'Could not delete stored file');
  }
}

/** POST /api/therapists/me/avatar (multipart, field "avatar") - replaces the profile picture. */
export const setMyAvatar: RequestHandler = async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, 'No file uploaded', 'FILE_MISSING');

  const detected = detectFileType(file.buffer);
  if (!detected || detected.mime === 'application/pdf') {
    throw new HttpError(400, 'Only JPG, PNG or WEBP images are allowed', 'FILE_TYPE_INVALID');
  }

  const profile = await findMyProfileDocument(req.auth?.userId);
  const processed = await processAvatar(file.buffer);

  // A new random key per upload: the URL changes, so browsers/CDNs never show a stale picture.
  const key = `${AVATAR_KEY_PREFIX}${profile.id as string}-${randomBytes(6).toString('hex')}.webp`;
  await storage.save('public', key, processed);

  const previousKey = profile.profileImageUrl ? storage.keyFromPublicUrl(profile.profileImageUrl) : null;
  try {
    profile.profileImageUrl = storage.publicUrl(key);
    await profile.save();
  } catch (err) {
    await removeQuietly(req, 'public', key); // don't leave an orphan if the database write failed
    throw err;
  }
  if (previousKey?.startsWith(AVATAR_KEY_PREFIX)) await removeQuietly(req, 'public', previousKey);

  res.json(await loadOwnProfileDto(profile._id));
};

/** DELETE /api/therapists/me/avatar - back to the initial-letter placeholder. */
export const removeMyAvatar: RequestHandler = async (req, res) => {
  const profile = await findMyProfileDocument(req.auth?.userId);
  const previousKey = profile.profileImageUrl ? storage.keyFromPublicUrl(profile.profileImageUrl) : null;

  profile.profileImageUrl = undefined;
  await profile.save();
  if (previousKey?.startsWith(AVATAR_KEY_PREFIX)) await removeQuietly(req, 'public', previousKey);

  res.json(await loadOwnProfileDto(profile._id));
};

const certificateSchema = z.object({ title: z.string().trim().min(2).max(150) });

/** POST /api/therapists/me/certificates (multipart: "title" + file "certificate") - optional credential, private. */
export const addMyCertificate: RequestHandler = async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, 'No file uploaded', 'FILE_MISSING');
  const { title } = certificateSchema.parse(req.body); // validate everything BEFORE writing any file

  const detected = detectFileType(file.buffer);
  if (!detected) throw new HttpError(400, 'Only PDF, JPG, PNG or WEBP files are allowed', 'FILE_TYPE_INVALID');

  const profile = await findMyProfileDocument(req.auth?.userId);
  if (profile.certificates.length >= MAX_CERTIFICATES) {
    throw new HttpError(400, `At most ${MAX_CERTIFICATES} certificates are allowed`, 'TOO_MANY_CERTIFICATES');
  }

  // Server-generated key; the client's file name is only kept as a label (never used as a path).
  const key = `certificates/${profile.id as string}/${randomUUID()}${detected.ext}`;
  await storage.save('private', key, file.buffer);

  try {
    profile.certificates.push({
      title,
      fileUrl: key,
      // Multer reads multipart file names as latin1; restore the real UTF-8 (Hebrew) name.
      originalName: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200),
      uploadedAt: new Date(),
      isVerified: false,
    });
    await profile.save();
  } catch (err) {
    await removeQuietly(req, 'private', key);
    throw err;
  }

  res.status(201).json(await loadOwnProfileDto(profile._id));
};

/** DELETE /api/therapists/me/certificates/:certId - remove one of my own certificates and its file. */
export const removeMyCertificate: RequestHandler = async (req, res) => {
  const certId = req.params.certId;
  if (typeof certId !== 'string' || !Types.ObjectId.isValid(certId)) throw new HttpError(400, 'Invalid certificate id');

  const profile = await findMyProfileDocument(req.auth?.userId);
  const index = profile.certificates.findIndex((c) => String((c as { _id?: Types.ObjectId })._id) === certId);
  const removed = profile.certificates[index];
  if (index === -1 || !removed) throw new HttpError(404, 'Certificate not found');

  profile.certificates.splice(index, 1);
  await profile.save();
  await removeQuietly(req, 'private', removed.fileUrl);

  res.json(await loadOwnProfileDto(profile._id));
};
