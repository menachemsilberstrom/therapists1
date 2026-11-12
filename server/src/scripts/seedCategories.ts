import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { CATEGORIES, upsertCategories } from './lib/categories.js';

async function seed(): Promise<void> {
  await connectDB();
  await upsertCategories();
  console.log(`Seeded ${CATEGORIES.length} categories`);
  await mongoose.disconnect();
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
