import * as React from 'react';

import { cn } from '../../lib/utils';

export interface ScrollFadeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The direction the content scrolls. */
  orientation?: 'horizontal' | 'vertical';
}

interface Edges {
  start: boolean;
  end: boolean;
}

const FADE = 'var(--spacing-section)';

/**
 * A scrolling area whose edges fade where more content waits, so a row of board columns, a wide
 * table or a long tab row shows that it scrolls. An edge with nothing beyond it stays sharp.
 */
const ScrollFade = React.forwardRef<HTMLDivElement, ScrollFadeProps>(
  (
    {
      orientation = 'horizontal',
      className,
      style,
      children,
      onScroll,
      ...props
    },
    ref,
  ) => {
    const inner = React.useRef<HTMLDivElement | null>(null);
    const [edges, setEdges] = React.useState<Edges>({
      start: false,
      end: false,
    });

    const measure = React.useCallback(() => {
      const element = inner.current;
      if (!element) return;
      const horizontal = orientation === 'horizontal';
      const position = horizontal
        ? Math.abs(element.scrollLeft)
        : element.scrollTop;
      const room = horizontal
        ? element.scrollWidth - element.clientWidth
        : element.scrollHeight - element.clientHeight;
      setEdges((now) => {
        const next = { start: position > 1, end: room - position > 1 };
        return now.start === next.start && now.end === next.end ? now : next;
      });
    }, [orientation]);

    React.useLayoutEffect(() => {
      const element = inner.current;
      if (!element) return;
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      for (const child of element.children) observer.observe(child);
      return () => observer.disconnect();
    }, [measure]);

    const direction = orientation === 'horizontal' ? 'to right' : 'to bottom';
    const mask = `linear-gradient(${direction}, ${edges.start ? 'transparent' : 'black'}, black ${FADE}, black calc(100% - ${FADE}), ${edges.end ? 'transparent' : 'black'})`;

    return (
      <div
        ref={(element) => {
          inner.current = element;
          if (typeof ref === 'function') ref(element);
          else if (ref) ref.current = element;
        }}
        // A keyboard reaches an area that scrolls, so it can scroll it with the arrow keys.
        tabIndex={edges.start || edges.end ? 0 : undefined}
        data-fade-start={edges.start || undefined}
        data-fade-end={edges.end || undefined}
        className={cn(
          orientation === 'horizontal' ? 'overflow-x-auto' : 'overflow-y-auto',
          'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        style={{ maskImage: mask, WebkitMaskImage: mask, ...style }}
        onScroll={(event) => {
          measure();
          onScroll?.(event);
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ScrollFade.displayName = 'ScrollFade';

export { ScrollFade };
