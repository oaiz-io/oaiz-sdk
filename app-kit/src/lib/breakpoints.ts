/**
 * Breakpoints and responsive design tokens for OAIZ UI.
 *
 * Every tier is a **min-width**, so the name means the same thing everywhere it
 * appears — in a stylesheet, in a media query string, and in TS:
 *
 *   `half:px-6`                     applies from 56.25rem up
 *   `MEDIA_QUERIES.half`            matches from 56.25rem up
 *   `useBreakpointAtLeast('half')`  true    from 56.25rem up
 *   `useBreakpoint() === 'half'`    true    from 56.25rem until `normal`
 *
 * Below the narrowest tier is `'base'`, mirroring an unprefixed CSS utility.
 *
 * - base:       < 40rem — phone; single column, drawer/sheet navigation
 * - mobile:    >= 40rem — large phone and up
 * - half:      >= 56.25rem — 2-up split screen / tiled desktop window
 * - normal:    >= 75rem — standard full laptop & desktop screen
 * - ultrawide: >= 96rem — large displays, max container width
 */

export const BREAKPOINTS = {
  mobile: '40rem',
  half: '56.25rem',
  normal: '75rem',
  ultrawide: '96rem',
} as const;

/** A tier with a min-width of its own. */
export type Breakpoint = keyof typeof BREAKPOINTS;

/** Every tier a viewport can be in, including the unprefixed `base` state. */
export type BreakpointTier = 'base' | Breakpoint;

/** Narrowest to widest. The single source of tier ordering. */
export const BREAKPOINT_ORDER = [
  'base',
  'mobile',
  'half',
  'normal',
  'ultrawide',
] as const satisfies readonly BreakpointTier[];

/** `tier:` in CSS — matches from the tier's min-width up. */
export const MEDIA_QUERIES = {
  mobile: `(min-width: ${BREAKPOINTS.mobile})`,
  half: `(min-width: ${BREAKPOINTS.half})`,
  normal: `(min-width: ${BREAKPOINTS.normal})`,
  ultrawide: `(min-width: ${BREAKPOINTS.ultrawide})`,
} as const;

/** The logical complement of the matching min-width query. */
export const MEDIA_QUERIES_BELOW = {
  mobile: `not all and ${MEDIA_QUERIES.mobile}`,
  half: `not all and ${MEDIA_QUERIES.half}`,
  normal: `not all and ${MEDIA_QUERIES.normal}`,
  ultrawide: `not all and ${MEDIA_QUERIES.ultrawide}`,
} as const;

export const TOUCH_TARGETS = {
  min: '2.75rem', // 44px (WCAG 2.5.5 / Apple HIG)
  compact: '2.25rem', // 36px dense touch target
  comfortable: '3rem', // 48px comfortable touch target (Android Material)
} as const;

export const SAFE_AREAS = {
  top: 'env(safe-area-inset-top, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
} as const;

export const SPACING_GUTTERS = {
  mobile: '1rem', // 16px
  tablet: '1.5rem', // 24px
  desktop: '2rem', // 32px
} as const;

export const LAYOUT_HEIGHTS = {
  mobileHeader: '3.5rem', // 56px
  mobileNav: '4rem', // 64px
} as const;
