import { api } from './client';
import type {
  AdminCategory,
  AdminStats,
  AdminTherapistDetail,
  AdminTherapistQuery,
  AdminTherapistRow,
  AuthResponse,
  Category,
  CityOption,
  LoginPayload,
  OwnTherapistProfile,
  PagedResult,
  RegisterPayload,
  TherapistCardData,
  TherapistProfile,
  TherapistSearchParams,
  UpdateProfilePayload,
  UserStatus,
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
  /** Cities that currently have visible therapists (search suggestions). */
  filterOptions: async (): Promise<{ cities: CityOption[] }> =>
    (await api.get<{ cities: CityOption[] }>('/therapists/filter-options')).data,
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

export const adminApi = {
  stats: async (): Promise<AdminStats> => (await api.get<AdminStats>('/admin/stats')).data,
  listTherapists: async (params: AdminTherapistQuery): Promise<PagedResult<AdminTherapistRow>> =>
    (await api.get<PagedResult<AdminTherapistRow>>('/admin/therapists', { params })).data,
  getTherapist: async (id: string): Promise<AdminTherapistDetail> =>
    (await api.get<AdminTherapistDetail>(`/admin/therapists/${encodeURIComponent(id)}`)).data,
  /** ACTIVE = approve / reactivate, SUSPENDED = suspend. The server keeps account status and visibility in sync. */
  setStatus: async (id: string, status: Extract<UserStatus, 'ACTIVE' | 'SUSPENDED'>): Promise<AdminTherapistDetail> =>
    (await api.patch<AdminTherapistDetail>(`/admin/therapists/${encodeURIComponent(id)}/status`, { status })).data,
  setCertificateVerified: async (id: string, certId: string, isVerified: boolean): Promise<AdminTherapistDetail> =>
    (
      await api.patch<AdminTherapistDetail>(
        `/admin/therapists/${encodeURIComponent(id)}/certificates/${encodeURIComponent(certId)}`,
        { isVerified },
      )
    ).data,
  /** Certificates are private: the file can only be fetched with the admin's token, so it comes back as a Blob. */
  fetchCertificate: async (id: string, certId: string): Promise<Blob> =>
    (
      await api.get<Blob>(
        `/admin/therapists/${encodeURIComponent(id)}/certificates/${encodeURIComponent(certId)}/file`,
        { responseType: 'blob' },
      )
    ).data,
  /** The server only deletes when confirmEmail equals the account's e-mail. */
  deleteTherapist: async (id: string, confirmEmail: string): Promise<{ deleted: boolean; filesRemoved: number }> =>
    (await api.delete<{ deleted: boolean; filesRemoved: number }>(`/admin/therapists/${encodeURIComponent(id)}`, { data: { confirmEmail } })).data,

  listCategories: async (): Promise<AdminCategory[]> => (await api.get<AdminCategory[]>('/admin/categories')).data,
  createCategory: async (payload: { name: string; slug: string }): Promise<AdminCategory> =>
    (await api.post<AdminCategory>('/admin/categories', payload)).data,
  updateCategory: async (id: string, patch: { name?: string; isActive?: boolean }): Promise<AdminCategory> =>
    (await api.patch<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}`, patch)).data,
};
