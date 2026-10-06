import React, { useEffect, useState, useRef } from 'react';

export interface NumberCounterProps {
  value: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function NumberCounter({
  value,
  durationMs = 600,
  prefix = '',
  suffix = '',
  className,
}: NumberCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      return;
    }

    let animationFrameId: number;
    const startValue = 0;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTimestampRef.current) startTimestampRef.current = timestamp;
      const progress = Math.min((timestamp - startTimestampRef.current) / durationMs, 1);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easedProgress);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, durationMs]);

  return (
    <span className={className}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}
