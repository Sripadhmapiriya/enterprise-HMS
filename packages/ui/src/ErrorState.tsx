import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { cn } from './utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this section. Please try again.',
  code,
  onRetry,
  retryLabel = 'Retry Request',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-lg border border-critical-border bg-critical-bg',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-surface text-critical flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-critical-text mb-1">{title}</h3>
      <p className="text-xs text-critical-text max-w-sm mb-2">{message}</p>
      {code && (
        <span className="text-[11px] font-mono bg-critical-bg text-critical-text border border-critical-border px-2 py-0.5 rounded mb-4">
          Error: {code}
        </span>
      )}
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}
          onClick={onRetry}
          className="border-critical-border text-critical-text hover:bg-critical-bg"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
