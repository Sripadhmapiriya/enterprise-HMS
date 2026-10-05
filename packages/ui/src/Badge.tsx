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
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
    warning:
      'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
    stable:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900',
    info:
      'bg-cyan-50 text-cyan-900 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-900',
    neutral:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    default:
      'bg-slate-900 text-white border-transparent dark:bg-slate-100 dark:text-slate-900',
    outline:
      'bg-transparent text-slate-700 border-slate-300 dark:text-slate-300 dark:border-slate-600',
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
