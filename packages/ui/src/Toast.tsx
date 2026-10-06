import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from './utils';
import { MOTION_DURATIONS, MOTION_EASINGS } from './motion';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const toastIcons = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />,
  error: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />,
  info: <Info className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />,
};

const toastStyles = {
  success: 'bg-slate-900 border-emerald-800 text-slate-100',
  warning: 'bg-slate-900 border-amber-800 text-slate-100',
  error: 'bg-slate-900 border-red-800 text-slate-100',
  info: 'bg-slate-900 border-cyan-800 text-slate-100',
};

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div
      aria-live="polite"
      aria-label="Notification toasts"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const variant = toast.variant || 'info';
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{
                duration: MOTION_DURATIONS.normal,
                ease: MOTION_EASINGS.decelerate,
              }}
              role="alert"
              className={cn(
                'pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg text-xs',
                toastStyles[variant]
              )}
            >
              {toastIcons[variant]}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{toast.title}</div>
                {toast.description && (
                  <div className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{toast.description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-white p-1 rounded-sm focus:outline-hidden focus:ring-1 focus:ring-cyan-400"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
