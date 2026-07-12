'use client';

import type { User, Firm, LoginRequest, LoginResponse } from '@/lib/types';
import { mockLogin } from '@/lib/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('counsel_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('counsel_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function getFirm(): Firm | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('counsel_firm');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Firm;
  } catch {
    return null;
  }
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
  // In production, this would call the real API.
  // For demo, use mock login directly.
  return mockLogin(req);
}

export function logout(): void {
  localStorage.removeItem('counsel_token');
  localStorage.removeItem('counsel_user');
  localStorage.removeItem('counsel_firm');
  localStorage.removeItem('counsel_use_mock');
  window.location.href = '/login';
}
