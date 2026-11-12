import { api } from './client';
import type {
  AuthResponse,
  Category,
  LoginPayload,
  OwnTherapistProfile,
  PagedResult,
  RegisterPayload,
  TherapistCardData,
  TherapistProfile,
  TherapistSearchParams,
  UpdateProfilePayload,
} from '../types';

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> =>
    (await api.post<AuthResponse>('/auth/login', payload)).data,
  register: async (payload: RegisterPayload): Promise<AuthResponse> =>
    (await api.post<AuthResponse>('/auth/register', payload)).data,
};

export const categoriesApi = {
  list: async (): Promise<Category[]> => (await api.get<Category[]>('/categories')).data,
};

export const therapistsApi = {
  list: async (params: TherapistSearchParams): Promise<PagedResult<TherapistCardData>> =>
    (await api.get<PagedResult<TherapistCardData>>('/therapists', { params })).data,
  getBySlug: async (slug: string): Promise<TherapistProfile> =>
    (await api.get<TherapistProfile>(`/therapists/${encodeURIComponent(slug)}`)).data,
  getMine: async (): Promise<OwnTherapistProfile> => (await api.get<OwnTherapistProfile>('/therapists/me')).data,
  updateMine: async (payload: UpdateProfilePayload): Promise<OwnTherapistProfile> =>
    (await api.put<OwnTherapistProfile>('/therapists/me', payload)).data,

  // Uploads are multipart/form-data; axios sets the boundary header itself when given a FormData.
  uploadAvatar: async (file: File): Promise<OwnTherapistProfile> => {
    const form = new FormData();
    form.append('avatar', file);
    return (await api.post<OwnTherapistProfile>('/therapists/me/avatar', form)).data;
  },
  deleteAvatar: async (): Promise<OwnTherapistProfile> =>
    (await api.delete<OwnTherapistProfile>('/therapists/me/avatar')).data,
  addCertificate: async (title: string, file: File): Promise<OwnTherapistProfile> => {
    const form = new FormData();
    form.append('title', title);
    form.append('certificate', file);
    return (await api.post<OwnTherapistProfile>('/therapists/me/certificates', form)).data;
  },
  deleteCertificate: async (id: string): Promise<OwnTherapistProfile> =>
    (await api.delete<OwnTherapistProfile>(`/therapists/me/certificates/${encodeURIComponent(id)}`)).data,
};
