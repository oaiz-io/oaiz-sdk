import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { STATUS_DOT_TONES, type StatusDotTone } from './status-dot';

export type BarListItem = {
  key: string;
  label: ReactNode;
  /** Sets the length of the bar. */
  amount: number;
  /** How the amount reads; the amount when omitted. */
  value?: ReactNode;
  /** The tone the same value has in its `StatusDot`. */
  tone?: StatusDotTone;
};

export type BarListProps = {
  items: BarListItem[];
  'aria-label'?: string;
};

/** Amounts to compare, one bar to a row. On a phone the bar takes its own full-width line. */
export function BarList({ items, 'aria-label': label }: BarListProps) {
  const largest = Math.max(0, ...items.map((item) => item.amount)) || 1;
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-[minmax(0,8rem)_1fr_auto] gap-x-stack gap-y-inline max-mobile:grid-cols-[minmax(0,1fr)_auto]"
    >
      {items.map((item) => (
        <li
          key={item.key}
          className="col-span-full grid grid-cols-subgrid items-center text-sm max-mobile:gap-y-1"
        >
          <span className="truncate">{item.label}</span>
          <span className="h-1.5 rounded-sm bg-muted max-mobile:col-span-full max-mobile:row-start-2">
            <span
              className={cn('block h-full rounded-sm', item.tone ? STATUS_DOT_TONES[item.tone] : 'bg-primary')}
              style={{ width: `${(Math.max(item.amount, 0) / largest) * 100}%` }}
            />
          </span>
          <span className="text-right tabular-nums">{item.value ?? item.amount}</span>
        </li>
      ))}
    </ul>
  );
}
