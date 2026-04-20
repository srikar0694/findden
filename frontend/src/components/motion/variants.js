// =============================================================================
// FindDen — Premium Motion System
// =============================================================================
// A small library of Framer Motion variants used across the platform to keep
// animation language consistent (timing, easing, staggers, hovers).
//
// Reusable variants:
//   - fadeIn         : opacity fade
//   - slideUp        : translate-up + fade
//   - slideDown      : translate-down + fade
//   - slideLeft      : translate-from-right + fade
//   - slideRight     : translate-from-left + fade
//   - scaleIn        : pop / scale + fade
//   - staggerParent  : container that staggers its children
//   - staggerItem    : default child variant for staggered grids
//   - cardHover      : interactive card hover/tap micro-interaction
//   - liftHover      : subtle elevate-on-hover for buttons/icons
// =============================================================================

// Premium Apple-ish ease (cubic bezier) — used everywhere for consistency.
export const EASE_PREMIUM = [0.22, 1, 0.36, 1];
export const EASE_SMOOTH  = [0.4, 0, 0.2, 1];

// ---------- Basic transitions ---------------------------------------------------

export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: EASE_PREMIUM },
  },
  exit:    { opacity: 0, transition: { duration: 0.25, ease: EASE_SMOOTH } },
};

export const slideUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_PREMIUM },
  },
  exit:    { opacity: 0, y: 16, transition: { duration: 0.25 } },
};

export const slideDown = {
  hidden:  { opacity: 0, y: -32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_PREMIUM } },
};

export const slideLeft = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE_PREMIUM } },
};

export const slideRight = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE_PREMIUM } },
};

export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: EASE_PREMIUM },
  },
};

// ---------- Stagger ------------------------------------------------------------

/**
 * Container variant that orchestrates child animations.
 * Pass options via `staggerContainer({ stagger, delay })`
 */
export const staggerContainer = ({ stagger = 0.08, delay = 0.05 } = {}) => ({
  hidden:  { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren: delay,
    },
  },
});

export const staggerItem = {
  hidden:  { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_PREMIUM },
  },
};

// ---------- Hover micro-interactions ------------------------------------------

export const cardHover = {
  rest:  { y: 0, scale: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' },
  hover: {
    y: -4,
    scale: 1.015,
    boxShadow: '0 18px 40px -12px rgba(15, 23, 42, 0.18)',
    transition: { duration: 0.25, ease: EASE_PREMIUM },
  },
  tap: { scale: 0.985, transition: { duration: 0.12 } },
};

export const liftHover = {
  rest:  { y: 0 },
  hover: { y: -2, transition: { duration: 0.2, ease: EASE_SMOOTH } },
  tap:   { y: 0, scale: 0.97, transition: { duration: 0.1 } },
};

// Convenient inline shorthand for any element to get a soft pop on hover.
export const softPop = {
  whileHover: { scale: 1.04, transition: { duration: 0.2, ease: EASE_PREMIUM } },
  whileTap:   { scale: 0.96, transition: { duration: 0.1 } },
};

// Page transition (use with AnimatePresence at route root if desired).
export const pageTransition = {
  initial:  { opacity: 0, y: 12 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_PREMIUM } },
  exit:     { opacity: 0, y: -8, transition: { duration: 0.25, ease: EASE_SMOOTH } },
};
