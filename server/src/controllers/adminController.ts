import type { Request, RequestHandler } from 'express';
import { Types, type PipelineStage } from 'mongoose';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { HttpError } from '../middlewares/errorHandler.js';
import { TherapistProfile } from '../models/TherapistProfile.js';
import { User, type UserStatus } from '../models/User.js';
import { storage } from '../storage/index.js';
import {
  mimeFromKey,
  toAdminDetail,
  toAdminRow,
  type AggregatedRow,
  type LeanUser,
} from '../utils/adminDto.js';
import { ACTIVE_CATEGORIES_POPULATE, type LeanProfile, type PopulatedCategory } from '../utils/profileDto.js';
import { escapeRegex } from '../utils/regex.js';

const listQuerySchema = z.object({
  status: z.enum(['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED']).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const statusBodySchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });
const verifyBodySchema = z.object({ isVerified: z.boolean() });
const deleteBodySchema = z.object({ confirmEmail: z.string().trim().min(1) });

function objectIdParam(value: unknown, label: string): Types.ObjectId {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) throw new HttpError(400, `Invalid ${label}`);
  return new Types.ObjectId(value);
}

/** The admin who made the request (requireAuth + requireRole('ADMIN') ran before every handler here). */
function adminId(req: Request): string {
  if (!req.auth) throw new HttpError(401, 'Authentication required');
  return req.auth.userId;
}

async function loadTherapist(userId: Types.ObjectId): Promise<{ user: LeanUser; profile: LeanProfile | null }> {
  // role: 'THERAPIST' on purpose: admins can never be viewed, changed or deleted through these endpoints.
  const user = await User.findOne({ _id: userId, role: 'THERAPIST' }, 'email status createdAt').lean();
  if (!user) throw new HttpError(404, 'Therapist not found');
  const profile = await TherapistProfile.findOne({ userId })
    .populate<{ categories: PopulatedCategory[] }>(ACTIVE_CATEGORIES_POPULATE)
    .lean();
  return { user, profile: profile as unknown as LeanProfile | null };
}

/** GET /api/admin/stats - counters for the tab badges. */
export const getStats: RequestHandler = async (_req, res) => {
  const count = (status?: UserStatus) =>
    User.countDocuments(status ? { role: 'THERAPIST', status } : { role: 'THERAPIST' });
  const [pending, active, suspended, total] = await Promise.all([
    count('PENDING_APPROVAL'),
    count('ACTIVE'),
    count('SUSPENDED'),
    count(),
  ]);
  res.json({ pending, active, suspended, total });
};

/** GET /api/admin/therapists - every therapist account (with or without a profile), filter + search + paging. */
export const listTherapists: RequestHandler = async (req, res) => {
  const { status, q, sort, page, limit } = listQuerySchema.parse(req.query);

  const stages: PipelineStage[] = [
    { $match: { role: 'THERAPIST', ...(status ? { status } : {}) } },
    { $lookup: { from: TherapistProfile.collection.name, localField: '_id', foreignField: 'userId', as: 'profile' } },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
  ];
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    stages.push({
      $match: { $or: [{ email: rx }, { 'profile.fullName': rx }, { 'profile.city': rx }, { 'profile.professionalTitle': rx }] },
    });
  }
  stages.push(
    { $sort: { createdAt: sort === 'oldest' ? 1 : -1, _id: 1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $addFields: {
              certificateCount: { $size: { $ifNull: ['$profile.certificates', []] } },
              verifiedCertificateCount: {
                $size: {
                  $filter: { input: { $ifNull: ['$profile.certificates', []] }, as: 'c', cond: { $eq: ['$$c.isVerified', true] } },
                },
              },
            },
          },
          {
            $project: {
              email: 1,
              status: 1,
              createdAt: 1,
              certificateCount: 1,
              verifiedCertificateCount: 1,
              'profile._id': 1,
              'profile.fullName': 1,
              'profile.professionalTitle': 1,
              'profile.city': 1,
              'profile.isPubliclyVisible': 1,
              'profile.profileImageUrl': 1,
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  );

  const [result] = await User.aggregate<{ items: AggregatedRow[]; total: { n: number }[] }>(stages);
  const total = result?.total[0]?.n ?? 0;
  res.json({
    items: (result?.items ?? []).map(toAdminRow),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
};

/** GET /api/admin/therapists/:id - everything an admin needs to review one therapist. */
export const getTherapist: RequestHandler = async (req, res) => {
  const { user, profile } = await loadTherapist(objectIdParam(req.params.id, 'therapist id'));
  res.json(toAdminDetail(user, profile));
};

/**
 * PATCH /api/admin/therapists/:id/status - approve / reactivate (ACTIVE) or suspend (SUSPENDED).
 * Account status and profile visibility always move together. The write order is chosen so that a failure
 * halfway can never leave a suspended account visible: hide first when suspending, show last when approving.
 */
export const setTherapistStatus: RequestHandler = async (req, res) => {
  const id = objectIdParam(req.params.id, 'therapist id');
  const { status } = statusBodySchema.parse(req.body);

  const user = await User.findOne({ _id: id, role: 'THERAPIST' });
  if (!user) throw new HttpError(404, 'Therapist not found');
  const profile = await TherapistProfile.findOne({ userId: id });

  if (status === 'ACTIVE') {
    if (!profile) throw new HttpError(409, 'This account has no profile to approve', 'NO_PROFILE');
    user.status = 'ACTIVE';
    await user.save();
    profile.isPubliclyVisible = true;
    await profile.save();
  } else {
    if (profile) {
      profile.isPubliclyVisible = false;
      await profile.save();
    }
    user.status = 'SUSPENDED';
    await user.save();
  }

  req.log.info({ adminId: adminId(req), therapistUserId: id.toString(), status }, 'therapist status changed by admin');
  const fresh = await loadTherapist(id);
  res.json(toAdminDetail(fresh.user, fresh.profile));
};

/** PATCH /api/admin/therapists/:id/certificates/:certId - mark a certificate verified (shows the profile badge) or not. */
export const setCertificateVerified: RequestHandler = async (req, res) => {
  const id = objectIdParam(req.params.id, 'therapist id');
  const certId = objectIdParam(req.params.certId, 'certificate id').toString();
  const { isVerified } = verifyBodySchema.parse(req.body);

  const profile = await TherapistProfile.findOne({ userId: id });
  const cert = profile?.certificates.find((c) => String((c as { _id?: Types.ObjectId })._id) === certId);
  if (!profile || !cert) throw new HttpError(404, 'Certificate not found');

  cert.isVerified = isVerified;
  await profile.save();

  req.log.info({ adminId: adminId(req), therapistUserId: id.toString(), certId, isVerified }, 'certificate verification changed');
  const fresh = await loadTherapist(id);
  res.json(toAdminDetail(fresh.user, fresh.profile));
};

/**
 * GET /api/admin/therapists/:id/certificates/:certId/file - streams a PRIVATE certificate.
 * This is the only way to read these files: it needs a valid admin token, never exposes the storage path,
 * is never cached, and every view is written to the log as an audit trail.
 */
export const downloadCertificate: RequestHandler = async (req, res) => {
  const id = objectIdParam(req.params.id, 'therapist id');
  const certId = objectIdParam(req.params.certId, 'certificate id').toString();

  const profile = await TherapistProfile.findOne({ userId: id }, 'certificates').lean();
  const cert = profile?.certificates.find((c) => String((c as { _id?: Types.ObjectId })._id) === certId);
  if (!cert) throw new HttpError(404, 'Certificate not found');

  const stream = await storage.openPrivate(cert.fileUrl);
  if (!stream) throw new HttpError(404, 'The certificate file is missing from storage', 'FILE_MISSING_FROM_STORAGE');

  req.log.info({ adminId: adminId(req), therapistUserId: id.toString(), certId }, 'certificate viewed by admin');
  res.setHeader('Content-Type', mimeFromKey(cert.fileUrl));
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(cert.originalName || 'certificate')}`);
  res.setHeader('Cache-Control', 'private, no-store');
  await pipeline(stream, res);
};

/**
 * DELETE /api/admin/therapists/:id - permanently removes the account, the profile and all uploaded files.
 * Guarded twice: only THERAPIST accounts can be deleted (never an admin), and the request must carry the account's
 * exact e-mail address as `confirmEmail`, so a stray or scripted call cannot delete someone by accident.
 */
export const deleteTherapist: RequestHandler = async (req, res) => {
  const id = objectIdParam(req.params.id, 'therapist id');
  const { confirmEmail } = deleteBodySchema.parse(req.body);

  const user = await User.findOne({ _id: id, role: 'THERAPIST' }, 'email').lean();
  if (!user) throw new HttpError(404, 'Therapist not found');
  if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    throw new HttpError(400, 'The confirmation e-mail does not match', 'CONFIRMATION_MISMATCH');
  }

  const profile = await TherapistProfile.findOne({ userId: id }, 'profileImageUrl certificates').lean();
  const avatarKey = profile?.profileImageUrl ? storage.keyFromPublicUrl(profile.profileImageUrl) : null;
  const certificateKeys = (profile?.certificates ?? []).map((c) => c.fileUrl);

  // Database first (the source of truth), files second: a leftover file is harmless, a dangling database record is not.
  await TherapistProfile.deleteOne({ userId: id });
  await User.deleteOne({ _id: id });

  let filesRemoved = 0;
  const removals: Promise<void>[] = [
    ...(avatarKey ? [storage.remove('public', avatarKey)] : []),
    ...certificateKeys.map((key) => storage.remove('private', key)),
  ];
  for (const result of await Promise.allSettled(removals)) {
    if (result.status === 'fulfilled') filesRemoved += 1;
    else req.log.warn({ err: result.reason }, 'Could not delete a stored file of a deleted therapist');
  }

  req.log.info(
    { adminId: adminId(req), deletedUserId: id.toString(), hadProfile: !!profile, filesRemoved },
    'therapist deleted by admin',
  );
  res.json({ deleted: true, filesRemoved });
};
