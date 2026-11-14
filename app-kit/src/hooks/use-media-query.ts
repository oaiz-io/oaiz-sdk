import * as React from 'react';

const noop = () => undefined;
const getServerSnapshot = () => false;

/** Shared subscribe/getSnapshot pair, so every responsive hook reads the same way. */
export function subscribeToQuery(query: string) {
  return (onStoreChange: () => void) => {
    if (typeof window === 'undefined') return noop;
    const list = window.matchMedia(query);
    list.addEventListener('change', onStoreChange);
    return () => list.removeEventListener('change', onStoreChange);
  };
}

/**
 * SSR-safe hook that subscribes to a CSS media query string.
 *
 * Reach for this only when the thing you are asking about is *not* a width
 * tier — orientation, `prefers-reduced-motion`, a one-off width. For tiers use
 * `useBreakpoint`, `useBreakpointAtLeast` or `useBreakpointBelow`, which stay
 * in step with the `mobile:` / `half:` / `normal:` / `ultrawide:` CSS variants.
 *
 * Uses `React.useSyncExternalStore`, so it is flicker-free and concurrent-safe.
 * The server snapshot is always `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useMemo(() => subscribeToQuery(query), [query]);

  const getSnapshot = React.useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
