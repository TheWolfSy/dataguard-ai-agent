import React from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'warning' | 'error' | 'success' | 'info';

export const Badge = ({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) => {
  const variants: Record<BadgeVariant, string> = {
    default: 'dg-badge dg-badge-default',
    warning: 'dg-badge dg-badge-warning',
    error:   'dg-badge dg-badge-error',
    success: 'dg-badge dg-badge-success',
    info:    'dg-badge dg-badge-info',
  };
  return (
    <span className={cn(variants[variant], 'dg-badge')}>
      {children}
    </span>
  );
};
