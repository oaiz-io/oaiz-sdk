import { useCallback, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

const CHANGED = 'oaiz:url-state';

/** The address a push writes once its view transition starts. */
let pending: URL | null = null;

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener(CHANGED, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(CHANGED, listener);
  };
}

export type UrlStateOptions = {
  /**
   * `push`: Back returns to the previous value, for a screen or an open record. `replace`: Back
   * skips it, for search, filters, sort and page.
   */
  history?: 'push' | 'replace';
};

/**
 * One value in the page address, read and set like `useState`, so that a reload and Back keep it
 * and a link shares it. The address leaves out a value equal to `initial`.
 */
export function useUrlState(
  key: string,
  initial = '',
  options: UrlStateOptions = {},
): [string, (next: string) => void] {
  const history = options.history ?? 'replace';
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(key) ?? initial,
  );
  const set = useCallback(
    (next: string) => {
      // Values set while a push waits for its transition join that push, so one click that sets
      // two values makes one history entry holding both.
      const url = new URL((pending ?? window.location).href);
      if (next === initial) url.searchParams.delete(key);
      else url.searchParams.set(key, next);
      if (pending) {
        pending = url;
        return;
      }
      if (url.href === window.location.href) return;
      if (history === 'replace') {
        window.history.replaceState(window.history.state, '', url);
        window.dispatchEvent(new Event(CHANGED));
        return;
      }
      pending = url;
      // A new screen or record cross-fades in, where the browser can and the member allows motion.
      const go = () =>
        flushSync(() => {
          const target = pending;
          pending = null;
          if (!target || target.href === window.location.href) return;
          window.history.pushState(window.history.state, '', target);
          window.dispatchEvent(new Event(CHANGED));
        });
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      if (reduce || typeof document.startViewTransition !== 'function') go();
      else {
        // A superseding transition can skip the animation after its navigation callback runs.
        void document.startViewTransition(go).ready.catch(() => undefined);
      }
    },
    [key, initial, history],
  );
  return [value, set];
}
