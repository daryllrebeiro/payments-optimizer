import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
}) => {
  const variants = {
    success: 'bg-green-100 text-green-800 ring-green-600/20',
    warning: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
    error: 'bg-red-100 text-red-800 ring-red-600/20',
    info: 'bg-blue-100 text-blue-800 ring-blue-600/20',
    neutral: 'bg-gray-100 text-gray-800 ring-gray-600/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md ring-1 ring-inset ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
};
