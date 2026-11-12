/**
 * Read-only health check of the database this app is configured to use.
 *
 *   npm run db:check
 *
 * It never writes anything. It shows which database is selected, what is in it, whether anything other than this
 * app's own data is present, and whether the data is consistent.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

const OURS = ['users', 'therapistprofiles', 'categories'] as const;
const SEED_EMAIL = /@seed\.invalid$/;

const ok = (msg: string) => console.log(`  [ok]   ${msg}`);
const warn = (msg: string) => console.log(`  [WARN] ${msg}`);

async function main(): Promise<void> {
  const database = await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database handle');

  console.log(`Database: "${database}"`);
  if (database === 'test') warn('this is the default "test" database. Put a database name in MONGODB_URI.');

  // ---- collections ----
  const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();
  console.log('\nCollections:');
  if (collections.length === 0) console.log('  (none: the database is empty)');
  for (const name of collections) {
    const n = await db.collection(name).countDocuments();
    console.log(`  ${(OURS as readonly string[]).includes(name) ? '  ' : '??'} ${name.padEnd(22)} ${n} document(s)`);
  }
  const foreign = collections.filter((c) => !(OURS as readonly string[]).includes(c));
  console.log('');
  if (foreign.length === 0) ok('only this app\'s collections are present (users, therapistprofiles, categories)');
  else warn(`collections that are NOT part of this app: ${foreign.join(', ')}  (the database is shared with something else)`);

  const users = db.collection('users');
  const profiles = db.collection('therapistprofiles');
  const categories = db.collection('categories');

  // ---- users ----
  console.log('\nUsers:');
  const [admins, therapists, seeded, noRole] = await Promise.all([
    users.countDocuments({ role: 'ADMIN' }),
    users.countDocuments({ role: 'THERAPIST' }),
    users.countDocuments({ email: SEED_EMAIL }),
    users.countDocuments({ role: { $exists: false } }),
  ]);
  console.log(`  admins: ${admins} | therapists: ${therapists} (of which seeded sample accounts: ${seeded})`);
  if (noRole > 0) warn(`${noRole} user document(s) have no role (they were not created by this app)`);
  else ok('every user document has a role');
  if (admins === 0) warn('no admin account yet: set ADMIN_EMAIL / ADMIN_PASSWORD in .env and run "npm run seed:admin"');

  // ---- profiles ----
  console.log('\nTherapist profiles:');
  const [total, visible] = await Promise.all([profiles.countDocuments(), profiles.countDocuments({ isPubliclyVisible: true })]);
  console.log(`  profiles: ${total} | publicly visible: ${visible}`);
  const orphanUsers = await users
    .aggregate([
      { $match: { role: 'THERAPIST' } },
      { $lookup: { from: 'therapistprofiles', localField: '_id', foreignField: 'userId', as: 'p' } },
      { $match: { p: { $size: 0 } } },
      { $count: 'n' },
    ])
    .toArray();
  const orphanProfiles = await profiles
    .aggregate([
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $match: { u: { $size: 0 } } },
      { $count: 'n' },
    ])
    .toArray();
  const noProfile = (orphanUsers[0]?.n as number | undefined) ?? 0;
  const noUser = (orphanProfiles[0]?.n as number | undefined) ?? 0;
  if (noProfile === 0) ok('every therapist account has a profile');
  else warn(`${noProfile} therapist account(s) have no profile (the admin panel lists them as "אין פרופיל")`);
  if (noUser === 0) ok('every profile belongs to an existing account');
  else warn(`${noUser} profile(s) belong to a missing account`);

  // ---- categories ----
  console.log('\nCategories:');
  const [catTotal, catActive, catForeign] = await Promise.all([
    categories.countDocuments(),
    categories.countDocuments({ isActive: true }),
    categories.countDocuments({ $or: [{ slug: { $not: { $type: 'string' } } }, { name: { $not: { $type: 'string' } } }] }),
  ]);
  console.log(`  categories: ${catTotal} | active: ${catActive}`);
  if (catForeign === 0) ok('every category has a name and a slug');
  else warn(`${catForeign} category document(s) have no name/slug (written by another application)`);
  if (catTotal === 0) warn('no categories yet: run "npm run seed"');

  // ---- indexes ----
  console.log('\nIndexes (created automatically when the app or a seed connects):');
  const wanted: [string, string, string][] = [
    ['users', 'email_1', 'unique e-mail per account'],
    ['therapistprofiles', 'userId_1', 'one profile per account'],
    ['therapistprofiles', 'slug_1', 'unique public URL per profile'],
    ['categories', 'slug_1', 'unique category slug'],
  ];
  for (const [coll, index, why] of wanted) {
    const exists = collections.includes(coll) && (await db.collection(coll).indexes()).some((i) => i.name === index && i.unique);
    if (exists) ok(`${coll}.${index} (${why})`);
    else warn(`${coll}.${index} is missing (${why})`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
