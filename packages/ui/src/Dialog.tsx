import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from './utils';
import { dialogTransitionVariants } from './motion';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  zIndex?: number | string;
  className?: string;
  bodyOverflowVisible?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  zIndex,
  className,
  bodyOverflowVisible = false,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dialogContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs',
            zIndex ? `z-[${zIndex}]` : ''
          )}
          style={zIndex ? { zIndex } : undefined}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby={description ? 'dialog-description' : undefined}
            variants={dialogTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'w-full bg-surface-raised rounded-lg shadow-xl border border-border',
              bodyOverflowVisible ? 'overflow-visible' : 'overflow-hidden',
              maxWidths[maxWidth],
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 id="dialog-title" className="text-base font-semibold text-text">
                  {title}
                </h2>
                {description && (
                  <p id="dialog-description" className="text-xs text-muted mt-0.5">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-1 rounded-md text-muted hover:text-text hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div
              className={cn(
                'p-5 max-h-[calc(85vh-130px)]',
                bodyOverflowVisible ? 'overflow-visible' : 'overflow-y-auto'
              )}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-surface-subtle border-t border-border">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted || typeof document === 'undefined') {
    return dialogContent;
  }

  return createPortal(dialogContent, document.body);
}
