import * as React from 'react';
import {
  BREAKPOINT_ORDER,
  MEDIA_QUERIES,
  MEDIA_QUERIES_BELOW,
  type Breakpoint,
  type BreakpointTier,
} from '../lib/breakpoints';
import { subscribeToQuery, useMediaQuery } from './use-media-query';

const noop = (): void => undefined;

/**
 * One subscription for every named tier boundary, so a hook re-reads on any
 * crossing. The browser evaluates the same rem media queries as Tailwind.
 */
function subscribeToTiers(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return noop;

  const unsubscribe = BREAKPOINT_ORDER.filter(
    (tier): tier is Breakpoint => tier !== 'base',
  ).map((tier) => subscribeToQuery(MEDIA_QUERIES[tier])(onStoreChange));

  return () => {
    unsubscribe.forEach((cleanup) => cleanup());
  };
}

/**
 * The widest tier whose min-width the viewport satisfies, or `'base'` below the
 * narrowest one.
 *
 * A tier name means exactly what the matching CSS variant means — `'half'` is
 * true from 56.25rem up, just as `half:` applies from 56.25rem up — so a
 * component that branches in TS and a stylesheet that branches in CSS never
 * disagree.
 * `'base'` is the unprefixed state.
 *
 *   base       < 40rem
 *   mobile    >= 40rem
 *   half      >= 56.25rem
 *   normal    >= 75rem
 *   ultrawide >= 96rem
 *
 * Prefer a CSS variant when the difference is purely visual; it costs no
 * render. Reach for this when the *markup* differs between tiers, or when a
 * value has to cross into JS.
 */
export function useBreakpoint(): BreakpointTier {
  return React.useSyncExternalStore(
    subscribeToTiers,
    computeTier,
    getServerTier,
  );
}

function computeTier(): BreakpointTier {
  if (typeof window === 'undefined') return getServerTier();

  let active: BreakpointTier = 'base';
  for (const tier of BREAKPOINT_ORDER) {
    if (tier !== 'base' && window.matchMedia(MEDIA_QUERIES[tier]).matches) {
      active = tier;
    }
  }
  return active;
}

const getServerTier = (): BreakpointTier => 'normal';
/**
 * True from `tier`'s min-width up — the TS twin of the `tier:` CSS variant.
 * `useBreakpointAtLeast('half')` is true exactly when `half:` applies.
 */
export function useBreakpointAtLeast(tier: Breakpoint): boolean {
  return useMediaQuery(MEDIA_QUERIES[tier]);
}

/**
 * True below `tier`'s min-width — the TS twin of the `max-tier:` CSS variant.
 * `useBreakpointBelow('half')` is true exactly when `max-half:` applies.
 */
export function useBreakpointBelow(tier: Breakpoint): boolean {
  return useMediaQuery(MEDIA_QUERIES_BELOW[tier]);
}

/**
 * True on a phone-width viewport: narrower than the 40rem mobile tier,
 * i.e. the `base` tier. Equivalent to `useBreakpointBelow('mobile')`, kept as a
 * named hook because "is this the phone layout?" is the question most call
 * sites are actually asking.
 *
 * Pass a tier or a pixel number to test against a different cutoff.
 */
export function useIsMobile(breakpoint?: number | Breakpoint): boolean {
  const query =
    typeof breakpoint === 'number'
      ? `not all and (min-width: ${breakpoint}px)`
      : MEDIA_QUERIES_BELOW[breakpoint ?? 'mobile'];
  return useMediaQuery(query);
}
