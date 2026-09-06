import React from 'react';

export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'md',
}) => {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '20px',
      }}
    >
      <div
        className="diagnostics-spinner"
        style={{
          borderTopColor: 'var(--brand-primary)',
          ...sizes[size],
        }}
      ></div>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontWeight: 500,
        }}
      >
        {message}
      </span>
    </div>
  );
};
