import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  key?: React.Key;
}) => (
  <div
    className={cn(
      'dg-card',
      className
    )}
    style={style}
  >
    {children}
  </div>
);
