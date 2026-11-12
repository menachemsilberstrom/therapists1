import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Category } from '../models/Category.js';

const categories = [
  { name: 'חרדה ומתח', slug: 'anxiety' },
  { name: 'דיכאון', slug: 'depression' },
  { name: 'טיפול זוגי', slug: 'couples-therapy' },
  { name: 'טיפול משפחתי', slug: 'family-therapy' },
  { name: 'טיפול בילדים', slug: 'child-therapy' },
  { name: 'נוער ובני נוער', slug: 'youth' },
  { name: 'טראומה ופוסט-טראומה', slug: 'trauma' },
  { name: 'הורות', slug: 'parenting' },
  { name: 'אבל ואובדן', slug: 'grief' },
  { name: 'הפרעות אכילה', slug: 'eating-disorders' },
  { name: 'התמכרויות', slug: 'addictions' },
  { name: 'קשיי קשב וריכוז', slug: 'adhd' },
];

async function seed(): Promise<void> {
  await connectDB();
  for (const c of categories) {
    await Category.updateOne({ slug: c.slug }, { $setOnInsert: { ...c, isActive: true } }, { upsert: true });
  }
  console.log(`Seeded ${categories.length} categories`);
  await mongoose.disconnect();
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
