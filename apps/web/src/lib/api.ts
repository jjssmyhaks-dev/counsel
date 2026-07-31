import type {
  Firm,
  User,
  Matter,
  Document,
  Analysis,
  ResearchBrief,
  Draft,
  Meeting,
  MeetingActionItem,
  MeetingDecision,
  KbAnswer,
  KbQueryRequest,
  AuditLog,
  Playbook,
  PlaybookRule,
  LoginRequest,
  LoginResponse,
  PaginatedResponse,
  CreateMatterRequest,
  CreateDraftRequest,
  CreateResearchRequest,
  Job,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isServer = typeof window === 'undefined';

  if (isServer) {
    throw new ApiError(0, 'API calls only available on client', 'SERVER_SIDE');
  }

  const token = localStorage.getItem('counsel_token');

  const headers: Record<string, string> = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('counsel_token');
      localStorage.removeItem('counsel_user');
      localStorage.removeItem('counsel_firm');
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired', 'UNAUTHORIZED');
    }
    const err = await res.json().catch(() => ({
      error: { code: 'UNKNOWN', message: res.statusText },
    }));
    throw new ApiError(
      res.status,
      err.error?.message || res.statusText,
      err.error?.code
    );
  }

  return res.json();
}

export const api = {
  get: async <T>(path: string): Promise<T> => {
    try {
      return await request<T>(path);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERVER_SIDE') throw err;
      throw err;
    }
  },

  post: async <T>(path: string, body?: unknown): Promise<T> => {
    try {
      const isFormData = body instanceof FormData;
      return await request<T>(path, {
        method: 'POST',
        body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined),
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERVER_SIDE') throw err;
      throw err;
    }
  },

  patch: async <T>(path: string, body: unknown): Promise<T> => {
    try {
      return await request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERVER_SIDE') throw err;
      throw err;
    }
  },

  delete: async <T>(path: string): Promise<T> => {
    try {
      return await request<T>(path, { method: 'DELETE' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERVER_SIDE') throw err;
      throw err;
    }
  },

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    try {
      const token = localStorage.getItem('counsel_token');
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('counsel_token');
          window.location.href = '/login';
          throw new ApiError(401, 'Session expired', 'UNAUTHORIZED');
        }
        throw new ApiError(res.status, 'Upload failed');
      }
      return res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw err;
    }
  },
};

// ── Mock Fallback Router ─────────────────────────────────────────

