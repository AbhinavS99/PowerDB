import api from './api';
import type { LoginRequest, RegisterRequest, TokenResponse, User } from '@/types';

export const authService = {
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/login', credentials);
    localStorage.setItem('token', data.access_token);
    return data;
  },

  async register(userData: RegisterRequest): Promise<User> {
    const { data } = await api.post<User>('/auth/register', userData);
    return data;
  },

  logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },
};
