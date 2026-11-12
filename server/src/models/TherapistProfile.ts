import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export type Gender = 'MALE' | 'FEMALE';
export type Region = 'NORTH' | 'CENTER' | 'JERUSALEM' | 'SOUTH' | 'ONLINE_ONLY';
export type TargetAudience = 'CHILDREN' | 'TEENS' | 'ADULTS' | 'COUPLES' | 'PARENTS';

export interface ICertificate {
  title: string;
  /** Private storage key of the uploaded file. Never exposed publicly; admins get it through an authenticated endpoint. */
  fileUrl: string;
  originalName: string;
  uploadedAt: Date;
  isVerified: boolean;
}

export interface IContactInfo {
  phone: string;
  whatsapp?: string;
  email?: string;
}

export interface ITherapistProfile {
  userId: Types.ObjectId;
  slug: string;
  fullName: string;
  professionalTitle: string;
  gender?: Gender;
  bio: string;
  profileImageUrl?: string;
  city: string;
  region?: Region;
  acceptsOnline: boolean;
  targetAudiences: TargetAudience[];
  categories: Types.ObjectId[];
  contactInfo: IContactInfo;
  certificates: ICertificate[];
  isPubliclyVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TherapistProfileDocument = HydratedDocument<ITherapistProfile>;

const certificateSchema = new Schema<ICertificate>(
  {
    title: { type: String, required: true },
    fileUrl: { type: String, required: true },
    originalName: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false },
  },
  { _id: true },
);

const therapistProfileSchema = new Schema<ITherapistProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    fullName: { type: String, default: '', trim: true },
    professionalTitle: { type: String, default: '', trim: true },
    gender: { type: String, enum: ['MALE', 'FEMALE'] },
    bio: { type: String, default: '' },
    profileImageUrl: { type: String },
    city: { type: String, default: '', trim: true },
    region: { type: String, enum: ['NORTH', 'CENTER', 'JERUSALEM', 'SOUTH', 'ONLINE_ONLY'] },
    acceptsOnline: { type: Boolean, default: false },
    targetAudiences: [
      { type: String, enum: ['CHILDREN', 'TEENS', 'ADULTS', 'COUPLES', 'PARENTS'] },
    ],
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    contactInfo: {
      phone: { type: String, default: '' },
      whatsapp: { type: String },
      email: { type: String },
    },
    certificates: [certificateSchema],
    isPubliclyVisible: { type: Boolean, default: false },
  },
  { timestamps: true },
);

therapistProfileSchema.index({ fullName: 'text', bio: 'text', professionalTitle: 'text' });

export const TherapistProfile = model<ITherapistProfile>('TherapistProfile', therapistProfileSchema);
