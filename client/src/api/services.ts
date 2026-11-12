import { api } from './client';
import type {
  AuthResponse,
  Category,
  LoginPayload,
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
  getMine: async (): Promise<TherapistProfile> => (await api.get<TherapistProfile>('/therapists/me')).data,
  updateMine: async (payload: UpdateProfilePayload): Promise<TherapistProfile> =>
    (await api.put<TherapistProfile>('/therapists/me', payload)).data,
};
