import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from './utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center text-xs text-slate-500', className)}>
      <ol className="flex items-center space-x-1.5 list-none p-0 m-0">
        <li>
          <a
            href="/dashboard"
            className="flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Home Dashboard"
          >
            <Home className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </li>
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center space-x-1.5">
            <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" aria-hidden="true" />
            {item.isCurrent || !item.href ? (
              <span className="font-semibold text-slate-800 dark:text-slate-200" aria-current="page">
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
