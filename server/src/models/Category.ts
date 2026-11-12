import { Schema, model, type HydratedDocument } from 'mongoose';

export interface ICategory {
  name: string;
  slug: string;
  isActive: boolean;
}

export type CategoryDocument = HydratedDocument<ICategory>;

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  isActive: { type: Boolean, default: true },
});

export const Category = model<ICategory>('Category', categorySchema);
