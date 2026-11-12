import type { Types } from 'mongoose';
import type { ICertificate, ITherapistProfile } from '../models/TherapistProfile.js';
import type { UserStatus } from '../models/User.js';
import type { LeanProfile } from './profileDto.js';

/** Accounts created by `npm run seed:therapists` use this e-mail domain. */
export const SEED_EMAIL_SUFFIX = '@seed.invalid';

export type CertificateFileType = 'pdf' | 'image';

/** One line of the admin lists. The id is the USER id, so accounts without a profile can still be managed. */
export interface AdminTherapistRow {
  id: string;
  email: string;
  accountStatus: UserStatus;
  isSeeded: boolean;
  hasProfile: boolean;
  fullName: string;
  professionalTitle: string;
  city: string;
  isPubliclyVisible: boolean;
  profileImageUrl?: string;
  certificateCount: number;
  verifiedCertificateCount: number;
  createdAt: Date;
}

export interface AdminCertificateDto {
  id: string;
  title: string;
  originalName: string;
  uploadedAt: Date;
  isVerified: boolean;
  fileType: CertificateFileType;
}

export interface AdminTherapistDetail extends AdminTherapistRow {
  slug?: string;
  bio: string;
  region?: ITherapistProfile['region'];
  gender?: ITherapistProfile['gender'];
  acceptsOnline: boolean;
  targetAudiences: ITherapistProfile['targetAudiences'];
  categories: { id: string; name: string; slug: string }[];
  contactInfo: ITherapistProfile['contactInfo'];
  certificates: AdminCertificateDto[];
}

/** Shape produced by the list aggregation (user left-joined with its profile). */
export interface AggregatedRow {
  _id: Types.ObjectId;
  email: string;
  status: UserStatus;
  createdAt: Date;
  profile?: {
    _id: Types.ObjectId;
    fullName: string;
    professionalTitle: string;
    city: string;
    isPubliclyVisible: boolean;
    profileImageUrl?: string;
  };
  certificateCount: number;
  verifiedCertificateCount: number;
}

export interface LeanUser {
  _id: Types.ObjectId;
  email: string;
  status: UserStatus;
  createdAt: Date;
}

export const certificateFileType = (storageKey: string): CertificateFileType =>
  storageKey.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Content type from the storage key's extension (the server chose that extension from the file's real bytes). */
export function mimeFromKey(storageKey: string): string {
  const ext = storageKey.slice(storageKey.lastIndexOf('.')).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}

export function toAdminRow(r: AggregatedRow): AdminTherapistRow {
  return {
    id: r._id.toString(),
    email: r.email,
    accountStatus: r.status,
    isSeeded: r.email.endsWith(SEED_EMAIL_SUFFIX),
    hasProfile: !!r.profile,
    fullName: r.profile?.fullName ?? '',
    professionalTitle: r.profile?.professionalTitle ?? '',
    city: r.profile?.city ?? '',
    isPubliclyVisible: r.profile?.isPubliclyVisible ?? false,
    profileImageUrl: r.profile?.profileImageUrl,
    certificateCount: r.certificateCount,
    verifiedCertificateCount: r.verifiedCertificateCount,
    createdAt: r.createdAt,
  };
}

export function toAdminDetail(user: LeanUser, profile: LeanProfile | null): AdminTherapistDetail {
  const certs = (profile?.certificates ?? []).map((c) => {
    const { _id } = c as ICertificate & { _id: Types.ObjectId }; // lean subdocuments carry an _id at runtime
    return {
      id: _id.toString(),
      title: c.title,
      originalName: c.originalName,
      uploadedAt: c.uploadedAt,
      isVerified: c.isVerified,
      fileType: certificateFileType(c.fileUrl), // fileUrl is the private storage key: only its type is exposed
    };
  });

  return {
    ...toAdminRow({
      _id: user._id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      profile: profile
        ? {
            _id: profile._id,
            fullName: profile.fullName,
            professionalTitle: profile.professionalTitle,
            city: profile.city,
            isPubliclyVisible: profile.isPubliclyVisible,
            profileImageUrl: profile.profileImageUrl,
          }
        : undefined,
      certificateCount: certs.length,
      verifiedCertificateCount: certs.filter((c) => c.isVerified).length,
    }),
    slug: profile?.slug,
    bio: profile?.bio ?? '',
    region: profile?.region,
    gender: profile?.gender,
    acceptsOnline: profile?.acceptsOnline ?? false,
    targetAudiences: profile?.targetAudiences ?? [],
    categories: (profile?.categories ?? []).map((c) => ({ id: c._id.toString(), name: c.name, slug: c.slug })),
    contactInfo: profile?.contactInfo ?? { phone: '' },
    certificates: certs,
  };
}
