'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User, Firm, LoginRequest } from '@/lib/types';
import { login as loginApi, logout as logoutApi, isAuthenticated, getUser, getFirm } from '@/lib/auth';
import { ApiError } from '@/lib/api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [firm, setFirm] = useState<Firm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      setUser(getUser());
      setFirm(getFirm());
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (req: LoginRequest) => {
    setError(null);
    setLoading(true);
    try {
      const resp = await loginApi(req);
      setUser(resp.user);
      setFirm(resp.firm);
      setLoading(false);
      return resp;
    } catch (err) {
      setLoading(false);
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setFirm(null);
    logoutApi();
  }, []);

  return {
    user,
    firm,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
