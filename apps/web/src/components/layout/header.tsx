'use client';

import React from 'react';
import { DropdownMenu } from '../ui/dropdown-menu';
import type { User } from '@/lib/types';

interface HeaderProps {
  user: User | null;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center justify-between h-full px-6">
        {/* Left side - page context could go here */}
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-slate-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </h2>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Notifications placeholder */}
          <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>

          {/* User menu */}
          {user && (
            <DropdownMenu
              align="right"
              trigger={
                <div className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-slate-700">{user.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              }
              items={[
                { label: 'Settings', onClick: () => (window.location.href = '/dashboard/settings') },
                { label: 'Sign out', danger: true, onClick: () => {
                  localStorage.removeItem('counsel_token');
                  localStorage.removeItem('counsel_user');
                  localStorage.removeItem('counsel_firm');
                  localStorage.removeItem('counsel_use_mock');
                  window.location.href = '/login';
                }},
              ]}
            />
          )}
        </div>
      </div>
    </header>
  );
}
