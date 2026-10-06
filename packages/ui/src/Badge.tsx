import React, { ReactNode } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  MinusCircle,
} from 'lucide-react';
import { cn } from './utils';
import { ClinicalStatus } from './types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ClinicalStatus | 'default' | 'outline';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  showDefaultIcon?: boolean;
}

const defaultIcons: Record<ClinicalStatus, ReactNode> = {
  critical: <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  stable: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  info: <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  neutral: <MinusCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
};

export function Badge({
  className,
  variant = 'neutral',
  size = 'md',
  icon,
  showDefaultIcon = true,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center font-medium rounded-full tabular-nums border transition-colors select-none';

  const variants: Record<string, string> = {
    critical:
      'bg-critical-bg text-critical-text border-critical-border',
    warning:
      'bg-warning-bg text-warning-text border-warning-border',
    stable:
      'bg-stable-bg text-stable-text border-stable-border',
    info:
      'bg-info-bg text-info-text border-info-border',
    neutral:
      'bg-neutral-bg text-neutral-text border-neutral-border',
    default:
      'bg-surface-raised text-text border-border',
    outline:
      'bg-transparent text-text border-border',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  // Status is never conveyed by color alone: automatically render icon if it's a clinical status
  const renderedIcon =
    icon ?? (showDefaultIcon && variant in defaultIcons ? defaultIcons[variant as ClinicalStatus] : null);

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {renderedIcon}
      <span>{children}</span>
    </span>
  );
}
