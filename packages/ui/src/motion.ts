/**
 * Enterprise HMS Shared Motion Tokens
 * Clinical Dial Configuration:
 * MOTION_INTENSITY: 4 (controlled, intentional, clinical-grade)
 * DESIGN_VARIANCE: 2 (clean, structured, disciplined)
 * VISUAL_DENSITY: 8 (compact clinical density)
 *
 * Rules:
 * - Uses only three duration values: 120ms (fast), 200ms (normal), 320ms (slow)
 * - Two easing curves: standard [0.2, 0, 0, 1] and decelerate [0, 0, 0.2, 1]
 * - One spring preset: stiffness 400, damping 30
 * - Clinical safety: No looping/infinite animations on patient data.
 * - Reduced motion: All transitions instantly settle or use subtle opacity only.
 */

// Core Duration Tokens (seconds for motion/react, ms for CSS/timeouts)
export const MOTION_DURATIONS = {
  fast: 0.12, // 120ms - micro-interactions, tooltips, small popovers
  normal: 0.2, // 200ms - dialogs, drawers, route crossfades, accordion open/close
  slow: 0.32, // 320ms - large drawer transitions, full screen transitions
  fastMs: 120,
  normalMs: 200,
  slowMs: 320,
} as const;

// Core Easing Curves
export const MOTION_EASINGS = {
  standard: [0.2, 0, 0, 1] as const, // Clinical smooth bidirectional
  decelerate: [0, 0, 0.2, 1] as const, // Natural incoming deceleration
  standardCss: 'cubic-bezier(0.2, 0, 0, 1)',
  decelerateCss: 'cubic-bezier(0, 0, 0.2, 1)',
} as const;

// Canonical Spring Preset
export const MOTION_SPRING = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
} as const;

// Dial Configuration Constants
export const MOTION_DIALS = {
  MOTION_INTENSITY: 4,
  DESIGN_VARIANCE: 2,
  VISUAL_DENSITY: 8,
} as const;

// Transition presets
export const transitions = {
  fast: {
    duration: MOTION_DURATIONS.fast,
    ease: MOTION_EASINGS.standard,
  },
  normal: {
    duration: MOTION_DURATIONS.normal,
    ease: MOTION_EASINGS.standard,
  },
  slow: {
    duration: MOTION_DURATIONS.slow,
    ease: MOTION_EASINGS.standard,
  },
  spring: MOTION_SPRING,
  decelerate: {
    duration: MOTION_DURATIONS.normal,
    ease: MOTION_EASINGS.decelerate,
  },
} as const;

// Clinical Safety Animation Guard
// Pulse keyframes: only pulses a few times (3x) then stops completely
export const clinicalAlertPulseVariants = {
  initial: { opacity: 1, scale: 1 },
  pulse: {
    opacity: [1, 0.7, 1],
    scale: [1, 1.04, 1],
    transition: {
      duration: MOTION_DURATIONS.slow,
      repeat: 2, // 3 pulses total, then stops
      ease: MOTION_EASINGS.standard,
    },
  },
};

// Page Transition Variants (crossfade & slight vertical translate under 200ms)
export const pageTransitionVariants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.normal,
      ease: MOTION_EASINGS.decelerate,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.standard,
    },
  },
};

// Reduced motion fallback variants
export const reducedMotionPageVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.01 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.01 },
  },
};

// Modal & Dialog Variants (scale 0.98 -> 1, opacity 0 -> 1)
export const dialogTransitionVariants = {
  initial: { opacity: 0, scale: 0.98, y: 4 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.normal,
      ease: MOTION_EASINGS.decelerate,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.standard,
    },
  },
};

// Drawer Transition Variants (Slide from left or right)
export const drawerTransitionVariants = {
  initial: { x: '-100%', opacity: 0.5 },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: MOTION_DURATIONS.slow,
      ease: MOTION_EASINGS.decelerate,
    },
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: {
      duration: MOTION_DURATIONS.normal,
      ease: MOTION_EASINGS.standard,
    },
  },
};

// Staggered Container for Dashboard Cards & Tables (first load only)
export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.normal,
      ease: MOTION_EASINGS.decelerate,
    },
  },
};
