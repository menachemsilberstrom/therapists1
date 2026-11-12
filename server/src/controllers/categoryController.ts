import type { RequestHandler } from 'express';
import { Category } from '../models/Category.js';

/** GET /api/categories - active categories (used by the search filter and the profile form). */
export const listCategories: RequestHandler = async (_req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
  res.json(categories.map((c) => ({ id: c._id.toString(), name: c.name, slug: c.slug })));
};
