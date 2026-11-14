import * as React from 'react';

import { useMediaQuery } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';

/**
 * The `--ease-enter` curve from tokens.css: the count moves fast at first and
 * settles slowly onto the target.
 */
const EASE_ENTER = [0.16, 1, 0.3, 1] as const;

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const coordinate = (t: number, p1: number, p2: number) =>
    3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  const slope = (t: number, p1: number, p2: number) =>
    3 * (1 - t) * (1 - t) * p1 +
    6 * (1 - t) * t * (p2 - p1) +
    3 * t * t * (1 - p2);

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = coordinate(t, x1, x2) - x;
      const derivative = slope(t, x1, x2);
      if (Math.abs(error) < 1e-5 || derivative === 0) break;
      t -= error / derivative;
    }
    return coordinate(Math.min(1, Math.max(0, t)), y1, y2);
  };
}

/** The `--ease-enter` token as a function, for animations driven from JavaScript. */
const easeEnter = cubicBezier(...EASE_ENTER);

export interface CountUpProps {
  value: number;
  /** Formats the target and every intermediate value. */
  format: (value: number) => string;
  /** Decimal places intermediate values round to before formatting. */
  fractionDigits?: number;
  /** Length of one count. */
  durationMs?: number;
  /** When false, the value renders immediately. */
  animate?: boolean;
  className?: string;
}

function roundTo(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

/**
 * Counts from zero to `value` on mount, and from the shown value to the new
 * one when `value` changes. The formatted target is laid out from the start, so
 * the width never jumps, and assistive technology reads only the target; the
 * counting digits are drawn over it. Under reduced motion the value renders
 * statically.
 */
function CountUp({
  value,
  format,
  fractionDigits = 0,
  durationMs = 1400,
  animate = true,
  className,
}: CountUpProps) {
  const prefersReducedMotion = useMediaQuery(
    '(prefers-reduced-motion: reduce)',
  );
  const shouldAnimate =
    animate && !prefersReducedMotion && Number.isFinite(value);
  // The value the count has reached; animation frames read and advance it.
  const reachedRef = React.useRef(0);
  const [shown, setShown] = React.useState<number | null>(
    shouldAnimate && value !== 0 ? 0 : null,
  );
  const [previousValue, setPreviousValue] = React.useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    // Keep showing the reached value until the next frame counts on from it.
    if (shouldAnimate) setShown(shown ?? previousValue);
  }

  React.useEffect(() => {
    if (!shouldAnimate) {
      reachedRef.current = value;
      return;
    }
    const from = reachedRef.current;
    let frame = 0;
    if (from === value) {
      frame = requestAnimationFrame(() => setShown(null));
      return () => cancelAnimationFrame(frame);
    }
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const progress = Math.min(1, (now - start) / durationMs);
      reachedRef.current = from + (value - from) * easeEnter(progress);
      if (progress < 1) {
        setShown(roundTo(reachedRef.current, fractionDigits));
        frame = requestAnimationFrame(step);
      } else {
        reachedRef.current = value;
        setShown(null);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, shouldAnimate, durationMs, fractionDigits]);

  const counting = shouldAnimate && shown !== null;

  return (
    <span
      className={cn('relative inline-block tabular-nums', className)}
      data-testid="count-up"
      data-counting={counting ? 'true' : undefined}
    >
      <span className={cn(counting && 'opacity-0')}>{format(value)}</span>
      {counting ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 whitespace-nowrap"
        >
          {format(shown ?? value)}
        </span>
      ) : null}
    </span>
  );
}

export { CountUp, easeEnter };
