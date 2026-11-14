import { useEffect, useRef } from 'react';

/** The class that eases an arriving item in; reduced motion stops it with every other animation. */
export const ARRIVAL_CLASS = 'animate-in fade-in-0 slide-in-from-bottom-1 duration-normal ease-enter';

/**
 * Tells which keys arrived after the first render, so a live list eases new items in without
 * animating everything that was there when the screen opened.
 */
export function useArrivals(keys: readonly (string | number)[]): (key: string | number) => boolean {
  const known = useRef<Set<string | number> | null>(null);
  if (known.current === null) known.current = new Set(keys);
  const seen = known.current;
  const arrived = new Set(keys.filter((key) => !seen.has(key)));
  useEffect(() => {
    for (const key of keys) seen.add(key);
  });
  return (key) => arrived.has(key);
}
