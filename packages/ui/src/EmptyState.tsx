import React, { ReactNode } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from './Button';
import { cn } from './utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-surface-subtle',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-surface text-muted flex items-center justify-center mb-3">
        {icon || <FolderOpen className="w-6 h-6" aria-hidden="true" />}
      </div>
      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-xs text-muted max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
