import React, { forwardRef, InputHTMLAttributes, ReactNode, useId } from 'react';
import { cn } from './utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftAdornment?: ReactNode;
  rightAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      id: customId,
      label,
      helperText,
      error,
      required,
      disabled,
      leftAdornment,
      rightAdornment,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold text-text">
            {label}
            {required && <span className="text-critical ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAdornment && (
            <div className="absolute left-3 flex items-center pointer-events-none text-muted">
              {leftAdornment}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            required={required}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              'w-full text-sm rounded-md border bg-surface px-3 py-2 text-text placeholder:text-subtle transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-brand',
              'disabled:bg-surface-subtle disabled:text-muted disabled:cursor-not-allowed',
              error ? 'border-critical focus:ring-critical focus:border-critical' : 'border-border',
              leftAdornment ? 'pl-9' : 'pl-3',
              rightAdornment ? 'pr-9' : 'pr-3',
              className
            )}
            {...props}
          />
          {rightAdornment && (
            <div className="absolute right-3 flex items-center text-muted">
              {rightAdornment}
            </div>
          )}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-critical-text font-medium">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
