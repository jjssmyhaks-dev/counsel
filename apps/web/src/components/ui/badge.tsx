import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export function Badge({ children, variant = 'default', size = 'sm', className = '', dot = false }: BadgeProps) {
  const variantClasses: Record<BadgeVariant, string> = {
    default: 'bg-[#f0f0f0] text-[#4b5551]',
    success: 'bg-[#eaf7f0] text-[#0a8a5f]',
    warning: 'bg-[#fef8e6] text-[#b45309]',
    danger: 'bg-[#fdf0ee] text-[#c2452e]',
    info: 'bg-[#eaf7f0] text-[#0a8a5f]',
    neutral: 'bg-black/[0.03] text-[#717d79]',
  };

  const dotColors: Record<BadgeVariant, string> = {
    default: 'bg-[#717d79]',
    success: 'bg-[#15b881]',
    warning: 'bg-amber-500',
    danger: 'bg-[#f0705b]',
    info: 'bg-[#15b881]',
    neutral: 'bg-[#969e9b]',
  };

  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
