// Mirrors the server DTOs (server/src/utils/profileDto.ts and the auth controller).

export type Region = 'NORTH' | 'CENTER' | 'JERUSALEM' | 'SOUTH' | 'ONLINE_ONLY';
export type Gender = 'MALE' | 'FEMALE';
export type TargetAudience = 'CHILDREN' | 'TEENS' | 'ADULTS' | 'COUPLES' | 'PARENTS';
export type UserRole = 'THERAPIST' | 'ADMIN';
export type UserStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface TherapistCardData {
  id: string;
  slug: string;
  fullName: string;
  professionalTitle: string;
  city: string;
  region?: Region;
  acceptsOnline: boolean;
  bioSnippet: string;
  profileImageUrl?: string;
  categories: Category[];
}

export interface ContactInfo {
  phone: string;
  whatsapp?: string;
  email?: string;
}

export interface TherapistProfile {
  id: string;
  slug: string;
  fullName: string;
  professionalTitle: string;
  city: string;
  region?: Region;
  acceptsOnline: boolean;
  profileImageUrl?: string;
  categories: Category[];
  bio: string;
  gender?: Gender;
  targetAudiences: TargetAudience[];
  contactInfo: ContactInfo;
  hasVerifiedCertificates: boolean;
  isPubliclyVisible: boolean;
}

/** A certificate as its owner sees it (the file itself is private and only visible to admins). */
export interface OwnCertificate {
  id: string;
  title: string;
  originalName: string;
  uploadedAt: string;
  isVerified: boolean;
}

/** The logged-in therapist's own profile: the public data plus their certificates. */
export interface OwnTherapistProfile extends TherapistProfile {
  certificates: OwnCertificate[];
  /** PENDING_APPROVAL = waiting for an admin. Always current: the server reads it from the database. */
  accountStatus: UserStatus;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TherapistSearchParams {
  q?: string;
  /** Category slugs, comma separated ("any of"). */
  category?: string;
  gender?: Gender;
  region?: Region;
  /** Part of a city name. */
  city?: string;
  /** Target audiences, comma separated ("any of"). */
  audience?: string;
  /** true = only therapists who also treat online. */
  online?: boolean;
  page?: number;
  limit?: number;
}

export interface CityOption {
  name: string;
  count: number;
}

export interface UpdateProfilePayload {
  fullName?: string;
  professionalTitle?: string;
  bio?: string;
  city?: string;
  phone?: string;
  whatsapp?: string;
  contactEmail?: string;
  categories?: string[]; // category slugs
  /** null clears the value. */
  gender?: Gender | null;
  region?: Region | null;
  acceptsOnline?: boolean;
  targetAudiences?: TargetAudience[];
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  fullName?: string;
}

// ---------- Admin panel (mirrors server/src/utils/adminDto.ts) ----------

export interface AdminStats {
  pending: number;
  active: number;
  suspended: number;
  total: number;
}

/** One line of the admin lists. `id` is the USER id (accounts without a profile can still be managed). */
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
  createdAt: string;
}

export interface AdminCertificate {
  id: string;
  title: string;
  originalName: string;
  uploadedAt: string;
  isVerified: boolean;
  fileType: 'pdf' | 'image';
}

export interface AdminTherapistDetail extends AdminTherapistRow {
  slug?: string;
  bio: string;
  region?: Region;
  gender?: Gender;
  acceptsOnline: boolean;
  targetAudiences: TargetAudience[];
  categories: Category[];
  contactInfo: ContactInfo;
  certificates: AdminCertificate[];
}

export interface AdminTherapistQuery {
  status?: UserStatus;
  q?: string;
  sort?: 'newest' | 'oldest';
  page?: number;
  limit?: number;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  usageCount: number;
}
