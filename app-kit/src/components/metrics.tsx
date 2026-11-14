import type { ReactNode } from 'react';

import { CountUp } from './ui/count-up';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';

export type Metric = {
  label: ReactNode;
  /** One short line of what the value counts. */
  detail?: ReactNode;
} & (
  | { value: ReactNode }
  /** A number that counts to each new value, written by `format`, such as `formatCurrency`. */
  | { amount: number; format?: (value: number) => string }
);

const plain = (value: number) => new Intl.NumberFormat().format(value);

export type MetricsProps = {
  items: Metric[];
  loading?: boolean;
};

/** The figures that head a screen, as one compact row: two to a line on a phone. */
export function Metrics({ items, loading = false }: MetricsProps) {
  return (
    <dl aria-busy={loading} className="flex flex-wrap gap-x-section gap-y-stack max-mobile:grid max-mobile:grid-cols-2">
      {items.map((item, index) => (
        <div key={index} className="flex min-w-0 flex-col gap-0.5">
          <Text asChild size="sm" variant="muted">
            <dt className="truncate">{item.label}</dt>
          </Text>
          <Text asChild size="lg" weight="semibold">
            <dd className="truncate tabular-nums">
              {loading ? (
                <Skeleton className="my-1 h-5 w-16" />
              ) : 'amount' in item ? (
                <CountUp value={item.amount} format={item.format ?? plain} />
              ) : (
                item.value
              )}
            </dd>
          </Text>
          {item.detail !== undefined && (
            <Text asChild size="xs" variant="muted">
              <dd className="truncate">{item.detail}</dd>
            </Text>
          )}
        </div>
      ))}
    </dl>
  );
}
