import type { RequestHandler } from 'express';
import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Category } from '../models/Category.js';
import { TherapistProfile, type ITherapistProfile } from '../models/TherapistProfile.js';
import { HttpError } from '../middlewares/errorHandler.js';
import {
  toCardDto,
  toProfileDto,
  type LeanProfile,
  type PopulatedCategory,
} from '../utils/profileDto.js';

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
  res.json(toProfileDto(profile));
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

  const updated = await findLeanProfile({ _id: profile._id });
  if (!updated) throw new HttpError(404, 'Profile not found');
  res.json(toProfileDto(updated));
};
