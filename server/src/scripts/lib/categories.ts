import { Category } from '../../models/Category.js';

export const CATEGORIES: ReadonlyArray<{ name: string; slug: string }> = [
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

/** Inserts missing categories; existing ones are left untouched. Safe to run repeatedly. */
export async function upsertCategories(): Promise<void> {
  for (const c of CATEGORIES) {
    await Category.updateOne({ slug: c.slug }, { $setOnInsert: { ...c, isActive: true } }, { upsert: true });
  }
}
