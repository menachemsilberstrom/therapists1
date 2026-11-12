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

/**
 * Short teaser for result cards: the first paragraph of the bio, whitespace collapsed,
 * cut at a word boundary. (Cutting the raw bio ran several sections together and split words.)
 */
export function makeSnippet(bio: string): string {
  const firstParagraph = (bio.split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim();
  if (firstParagraph.length <= SNIPPET_LENGTH) return firstParagraph;
  const cut = firstParagraph.slice(0, SNIPPET_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > SNIPPET_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trimEnd().replace(/[,;:.\-–]+$/, '')}…`;
}

const toCategoryDtos =(cats: PopulatedCategory[]): CategoryDto[] =>
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
    bioSnippet: makeSnippet(p.bio),
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
