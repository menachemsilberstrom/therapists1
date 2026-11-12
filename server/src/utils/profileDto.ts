import type { Types } from 'mongoose';
import type { ITherapistProfile } from '../models/TherapistProfile.js';

export interface PopulatedCategory {
  _id: Types.ObjectId;
  name: string;
  slug: string;
}

/** Shape returned by `.lean()` when `categories` is populated. */
export type LeanProfile = Omit<ITherapistProfile, 'categories'> & {
  _id: Types.ObjectId;
  categories: PopulatedCategory[];
};

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
}

/** Compact version for search result cards. */
export interface TherapistCardDto {
  id: string;
  slug: string;
  fullName: string;
  professionalTitle: string;
  city: string;
  region?: ITherapistProfile['region'];
  acceptsOnline: boolean;
  bioSnippet: string;
  profileImageUrl?: string;
  categories: CategoryDto[];
}

/** Full profile. Certificates and userId are deliberately NOT exposed. */
export interface TherapistProfileDto extends Omit<TherapistCardDto, 'bioSnippet'> {
  bio: string;
  gender?: ITherapistProfile['gender'];
  targetAudiences: ITherapistProfile['targetAudiences'];
  contactInfo: ITherapistProfile['contactInfo'];
  hasVerifiedCertificates: boolean;
  isPubliclyVisible: boolean;
}

const SNIPPET_LENGTH = 160;

const toCategoryDtos = (cats: PopulatedCategory[]): CategoryDto[] =>
  cats.map((c) => ({ id: c._id.toString(), name: c.name, slug: c.slug }));

export function toCardDto(p: LeanProfile): TherapistCardDto {
  return {
    id: p._id.toString(),
    slug: p.slug,
    fullName: p.fullName,
    professionalTitle: p.professionalTitle,
    city: p.city,
    region: p.region,
    acceptsOnline: p.acceptsOnline,
    bioSnippet: p.bio.length > SNIPPET_LENGTH ? `${p.bio.slice(0, SNIPPET_LENGTH).trimEnd()}…` : p.bio,
    profileImageUrl: p.profileImageUrl,
    categories: toCategoryDtos(p.categories),
  };
}

export function toProfileDto(p: LeanProfile): TherapistProfileDto {
  return {
    id: p._id.toString(),
    slug: p.slug,
    fullName: p.fullName,
    professionalTitle: p.professionalTitle,
    city: p.city,
    region: p.region,
    acceptsOnline: p.acceptsOnline,
    profileImageUrl: p.profileImageUrl,
    categories: toCategoryDtos(p.categories),
    bio: p.bio,
    gender: p.gender,
    targetAudiences: p.targetAudiences,
    contactInfo: p.contactInfo,
    hasVerifiedCertificates: p.certificates.some((c) => c.isVerified),
    isPubliclyVisible: p.isPubliclyVisible,
  };
}
