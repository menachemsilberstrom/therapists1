/**
 * Seeds MongoDB with the therapists listed in the sample directory document (.docx).
 *
 *   npm run seed:therapists                      # import (idempotent: re-running updates, never duplicates)
 *   npm run seed:therapists -- --dry-run         # parse only, print statistics, touch no database
 *   npm run seed:therapists -- --reset           # delete previously seeded therapists first
 *   npm run seed:therapists -- --file "path.docx"
 *
 * By default the only .docx file in the project root is used (or set SEED_DOCX_PATH).
 *
 * Every seeded therapist gets a placeholder account (seed-<hash>@seed.invalid) with a random password nobody
 * knows, so the profile shows up in the directory but cannot be logged into. These accounts are what --reset removes.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Category } from '../models/Category.js';
import { TherapistProfile } from '../models/TherapistProfile.js';
import { User } from '../models/User.js';
import { upsertCategories } from './lib/categories.js';
import { readDocxTables } from './lib/docxTables.js';
import { mapTablesToTherapists, type SeedTherapist } from './lib/therapistMapper.js';

const SEED_EMAIL_DOMAIN = 'seed.invalid';

interface Options {
  file?: string;
  dryRun: boolean;
  reset: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, reset: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--reset') options.reset = true;
    else if (arg === '--file') {
      options.file = argv[i + 1];
      i += 1;
    } else throw new Error(`Unknown argument: ${arg ?? ''}`);
  }
  if (argv.includes('--file') && !options.file) throw new Error('--file needs a path');
  return options;
}

async function findDocx(explicit: string | undefined): Promise<string> {
  const chosen = explicit ?? process.env.SEED_DOCX_PATH;
  if (chosen) return path.resolve(chosen);

  const projectRoot = path.resolve(process.cwd(), '..');
  const candidates = (await readdir(projectRoot)).filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'));
  if (candidates.length === 1 && candidates[0]) return path.join(projectRoot, candidates[0]);
  throw new Error(
    candidates.length === 0
      ? `No .docx file found in ${projectRoot}. Pass --file "<path>" or set SEED_DOCX_PATH.`
      : `Found ${candidates.length} .docx files in ${projectRoot}. Pass --file "<path>" to choose one.`,
  );
}

const hash = (value: string): string => createHash('sha1').update(value).digest('hex');

function makeSlug(t: SeedTherapist): string {
  const base = t.fullName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'therapist'}-${hash(t.key).slice(0, 6)}`; // deterministic suffix => stable URLs across re-runs
}

function printStats(therapists: SeedTherapist[], stats: ReturnType<typeof mapTablesToTherapists>['stats']): void {
  const count = (pred: (t: SeedTherapist) => boolean): number => therapists.filter(pred).length;
  const byRegion = (r: string): number => count((t) => t.region === r);
  console.log('Parsed document:');
  console.log(`  tables: ${stats.tables}, rows read: ${stats.rowsRead}`);
  console.log(`  skipped: ${stats.blankRows} blank rows, ${stats.organisationRows} organisation rows (not individual therapists)`);
  console.log(`  merged ${stats.duplicatesMerged} duplicate listings (therapists that appear under several regions)`);
  console.log(`  therapists to seed: ${stats.therapists}`);
  console.log(
    `  by region: north ${byRegion('NORTH')}, center ${byRegion('CENTER')}, jerusalem ${byRegion('JERUSALEM')}, south ${byRegion('SOUTH')}`,
  );
  console.log(
    `  data coverage: phone ${count((t) => !!t.phone)}, email ${count((t) => !!t.email)}, ` +
      `online ${count((t) => t.acceptsOnline)}, gender inferred ${count((t) => !!t.gender)}, ` +
      `with categories ${count((t) => t.categorySlugs.length > 0)}`,
  );
  if (stats.unknownRegionTables > 0) console.log(`  WARNING: ${stats.unknownRegionTables} table(s) skipped: unrecognised region heading`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const file = await findDocx(options.file);
  console.log(`Reading ${path.basename(file)}`);

  const { therapists, stats } = mapTablesToTherapists(await readDocxTables(file));
  printStats(therapists, stats);
  if (options.dryRun) {
    console.log('Dry run: nothing was written to the database.');
    return;
  }
  if (therapists.length === 0) throw new Error('Nothing to seed: no therapists were found in the document');

  await connectDB();

  // Make sure the categories exist, then resolve slug -> _id.
  await upsertCategories();
  const categoryIds = new Map((await Category.find({}, 'slug').lean()).map((c) => [c.slug, c._id]));

  if (options.reset) {
    const seededUsers = await User.find({ email: new RegExp(`@${SEED_EMAIL_DOMAIN.replace('.', '\\.')}$`) }, '_id').lean();
    const ids = seededUsers.map((u) => u._id);
    const profiles = await TherapistProfile.deleteMany({ userId: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    console.log(`Reset: removed ${ids.length} seeded accounts and ${profiles.deletedCount} profiles`);
  }

  let created = 0;
  let updated = 0;
  for (const t of therapists) {
    const email = `seed-${hash(t.key).slice(0, 12)}@${SEED_EMAIL_DOMAIN}`;
    let user = await User.findOne({ email });
    if (!user) {
      // Random, never-shared password: the account exists only to own the profile. Low cost factor is fine for that.
      const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 4);
      user = await User.create({ email, passwordHash, role: 'THERAPIST', status: 'ACTIVE' });
    }

    const fields = {
      fullName: t.fullName,
      professionalTitle: t.professionalTitle,
      gender: t.gender,
      bio: t.bio,
      city: t.city,
      region: t.region,
      acceptsOnline: t.acceptsOnline,
      targetAudiences: t.targetAudiences,
      categories: t.categorySlugs.flatMap((slug) => categoryIds.get(slug) ?? []),
      contactInfo: { phone: t.phone, whatsapp: t.whatsapp, email: t.email },
      isPubliclyVisible: true,
    };

    const result = await TherapistProfile.updateOne(
      { userId: user._id },
      { $set: fields, $setOnInsert: { userId: user._id, slug: makeSlug(t) } },
      { upsert: true },
    );
    if (result.upsertedCount > 0) created += 1;
    else updated += 1;
  }

  console.log(`Done: ${created} created, ${updated} updated. Start the apps and open http://localhost:5173`);
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
