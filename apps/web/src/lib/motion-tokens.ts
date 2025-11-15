/**
 * Global Motion System - Unified timing and easing tokens
 * Mobile-first approach with consistent animation grammar across the app
 */

// Global timing grammar (in milliseconds)
export const MOTION_DURATION = {
  ENTRY: 0.16,      // 160ms - Component mount/entry
  EMPHASIS: 0.12,   // 120ms - Button tap, selection feedback
  MICRO: 0.06,      // 60ms - Subtle interior shifts, tooltips
  EXIT: 0.14,       // 140ms - Dismiss, close, fade-out
} as const;

// Global easing - Natural cubic-bezier for all transitions
export const NATURAL_EASE = [0.4, 0, 0.2, 1] as const;

// Mobile detection utility
export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
};

// Shared motion variants for common patterns
export const fadeInVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: MOTION_DURATION.ENTRY, ease: NATURAL_EASE },
};

export const slideUpVariant = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: MOTION_DURATION.ENTRY, ease: NATURAL_EASE },
};

export const tapFeedbackVariant = {
  whileTap: { scale: 0.98 },
  transition: { duration: MOTION_DURATION.MICRO, ease: NATURAL_EASE },
};

// Stagger delays for sequential reveals
export const STAGGER_DELAYS = {
  BACKGROUND: 0,
  BUILDINGS: 0.08,
  PIG: 0.12,
  NAV: 0.16,
} as const;
