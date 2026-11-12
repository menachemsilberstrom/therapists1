import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../middlewares/errorHandler.js';
import { Category } from '../models/Category.js';
import { TherapistProfile } from '../models/TherapistProfile.js';

/**
 * Only documents shaped like OUR categories (string name + slug). The collection can also hold documents written by
 * other applications that share the same database; those must never be listed, renamed or counted as duplicates.
 */
const OUR_CATEGORIES = { name: { $type: 'string' }, slug: { $type: 'string' } } as const;

interface AdminCategoryDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  /** How many profiles currently use this category. */
  usageCount: number;
}

const nameSchema = z.string().trim().min(2).max(60);

const createSchema = z.object({
  name: nameSchema,
  // The slug appears in URLs and filters, so it is latin-only and cannot be changed later.
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase latin letters, digits and single hyphens'),
});

const updateSchema = z
  .object({ name: nameSchema.optional(), isActive: z.boolean().optional() })
  .refine((v) => v.name !== undefined || v.isActive !== undefined, { message: 'Nothing to update' });

async function usageCounts(): Promise<Map<string, number>> {
  const rows = await TherapistProfile.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $unwind: '$categories' },
    { $group: { _id: '$categories', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.count]));
}

const toDto = (c: { _id: Types.ObjectId; name: string; slug: string; isActive: boolean }, usageCount: number): AdminCategoryDto => ({
  id: c._id.toString(),
  name: c.name,
  slug: c.slug,
  isActive: c.isActive,
  usageCount,
});

/** GET /api/admin/categories - all categories, including deactivated ones, with how many profiles use each. */
export const listAdminCategories: RequestHandler = async (_req, res) => {
  const [categories, usage] = await Promise.all([Category.find(OUR_CATEGORIES).sort({ name: 1 }).lean(), usageCounts()]);
  res.json(categories.map((c) => toDto(c, usage.get(c._id.toString()) ?? 0)));
};

/** POST /api/admin/categories */
export const createCategory: RequestHandler = async (req, res) => {
  const { name, slug } = createSchema.parse(req.body);
  if (await Category.exists({ slug })) throw new HttpError(409, 'This slug is already used', 'CATEGORY_SLUG_TAKEN');
  if (await Category.exists({ ...OUR_CATEGORIES, name })) {
    throw new HttpError(409, 'A category with this name already exists', 'CATEGORY_NAME_TAKEN');
  }

  const created = await Category.create({ name, slug, isActive: true });
  req.log.info({ categoryId: created.id as string }, 'category created by admin');
  res.status(201).json(toDto(created, 0));
};

/** PATCH /api/admin/categories/:id - rename and/or (de)activate. Categories are never deleted; deactivate instead. */
export const updateCategory: RequestHandler = async (req, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) throw new HttpError(400, 'Invalid category id');
  const { name, isActive } = updateSchema.parse(req.body);

  const category = await Category.findOne({ _id: id, ...OUR_CATEGORIES });
  if (!category) throw new HttpError(404, 'Category not found');

  if (name !== undefined && name !== category.name) {
    if (await Category.exists({ ...OUR_CATEGORIES, name, _id: { $ne: category._id } })) {
      throw new HttpError(409, 'A category with this name already exists', 'CATEGORY_NAME_TAKEN');
    }
    category.name = name;
  }
  if (isActive !== undefined) category.isActive = isActive;
  await category.save();

  req.log.info({ categoryId: id, renamed: name !== undefined, isActive }, 'category updated by admin');
  res.json(toDto(category, (await usageCounts()).get(id) ?? 0));
};
