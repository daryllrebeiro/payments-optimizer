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
    sm: { height: '16px', width: '16px', borderWidth: '2px' },
    md: { height: '32px', width: '32px', borderWidth: '2px' },
    lg: { height: '48px', width: '48px', borderWidth: '4px' },
  } as const;

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
