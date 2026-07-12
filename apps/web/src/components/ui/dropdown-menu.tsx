'use client';

import React, { useState } from 'react';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: {
    label: string;
    onClick?: () => void;
    href?: string;
    danger?: boolean;
    icon?: React.ReactNode;
  }[];
  align?: 'left' | 'right';
}

export function DropdownMenu({ trigger, items, align = 'right' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-50 mt-2 w-56 rounded-lg bg-white border border-slate-200 shadow-lg py-1 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors
                  ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
