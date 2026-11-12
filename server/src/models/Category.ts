import { Schema, model, type HydratedDocument } from 'mongoose';

export interface ICategory {
  name: string;
  slug: string;
  isActive: boolean;
}

export type CategoryDocument = HydratedDocument<ICategory>;

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
});

// Unique only among documents that HAVE a slug. The collection may also contain documents from other applications
// sharing the database (no slug at all), which would make a plain unique index impossible to build.
categorySchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: 'string' } } });

export const Category = model<ICategory>('Category', categorySchema);
