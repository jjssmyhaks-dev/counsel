'use client';

import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { User } from '@/lib/types';

interface UserTableProps {
  users: User[];
  loading?: boolean;
}

const ROLE_MAP: Record<string, { variant: 'info' | 'success' | 'warning' | 'neutral'; label: string }> = {
  admin: { variant: 'info', label: 'Admin' },
  partner: { variant: 'success', label: 'Partner' },
  associate: { variant: 'warning', label: 'Associate' },
  paralegal: { variant: 'neutral', label: 'Paralegal' },
  viewer: { variant: 'neutral', label: 'Viewer' },
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function UserTable({ users, loading }: UserTableProps) {
  const [editingRole, setEditingRole] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="w-8 h-8 rounded-full bg-slate-200" />
              <div className="h-4 bg-slate-200 rounded w-32" />
              <div className="h-4 bg-slate-200 rounded w-48" />
              <div className="h-6 bg-slate-200 rounded-full w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Last Login</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const role = ROLE_MAP[user.role] || ROLE_MAP.viewer;
              return (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                        {user.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{user.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={role.variant}>{role.label}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{formatDate(user.lastLoginAt)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditingRole(user.id)}>
                      Edit Role
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
