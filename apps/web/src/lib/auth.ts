'use client';

import type { User, Firm, LoginRequest, LoginResponse } from '@/lib/types';

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || 'Login failed');
  }
  const data = await res.json();
  // Persist auth state
  if (typeof window !== 'undefined') {
    localStorage.setItem('counsel_token', data.token);
    localStorage.setItem('counsel_user', JSON.stringify(data.user));
    if (data.firm) localStorage.setItem('counsel_firm', JSON.stringify(data.firm));
  }
  return data;
}

export function logout(): void {
  localStorage.removeItem('counsel_token');
  localStorage.removeItem('counsel_user');
  localStorage.removeItem('counsel_firm');
  localStorage.removeItem('counsel_use_mock');
  window.location.href = '/login';
}
