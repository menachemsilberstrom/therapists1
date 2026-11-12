import { Schema, model, type HydratedDocument } from 'mongoose';

export type UserRole = 'THERAPIST' | 'ADMIN';
export type UserStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';

export interface IUser {
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['THERAPIST', 'ADMIN'], default: 'THERAPIST', required: true },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED'],
      default: 'PENDING_APPROVAL',
      required: true,
    },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);
