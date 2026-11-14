import { useCallback, useEffect, useSyncExternalStore } from 'react';

/** The member's choice: a fixed theme, or whatever their system uses. */
export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'oaiz.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();
// The choice for this page, for a browser that refuses storage.
let pageChoice: ThemeChoice = 'system';

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return pageChoice;
  }
}

function systemIsDark(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.(DARK_QUERY).matches ?? false);
}

/** Puts the `dark` class on `<html>`, where the theme's tokens read it, for the stored choice. */
export function applyStoredTheme(): void {
  if (typeof document === 'undefined') return;
  const choice = readChoice();
  const dark = choice === 'dark' || (choice === 'system' && systemIsDark());
  document.documentElement.classList.toggle('dark', dark);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * The member's theme on this app: light, dark or the system's, remembered in this browser. Call
 * `applyStoredTheme()` once in `main.tsx` before rendering, so the first paint has the right
 * colours; this hook then follows the system while the choice is `system`.
 */
export function useTheme() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => 'system' as ThemeChoice);

  useEffect(() => {
    applyStoredTheme();
    if (choice !== 'system') return;
    const query = window.matchMedia?.(DARK_QUERY);
    query?.addEventListener('change', applyStoredTheme);
    return () => query?.removeEventListener('change', applyStoredTheme);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    pageChoice = next;
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // readChoice answers pageChoice while storage is refused.
    }
    applyStoredTheme();
    for (const listener of listeners) listener();
  }, []);

  return { choice, setChoice };
}
