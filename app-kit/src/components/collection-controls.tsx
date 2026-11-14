import { useEffect, useId, type ReactNode } from 'react';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select';

export type CollectionPage = {
  index: number;
  size: number;
  count: number;
  onChange: (index: number) => void;
};

export type PagerLabels = {
  pages: string;
  previous: string;
  next: string;
  range: (first: number, last: number, count: number) => string;
};

export function Pager({
  page,
  loading = false,
  labels,
}: {
  page: CollectionPage;
  loading?: boolean;
  labels?: Partial<PagerLabels>;
}) {
  const lastPage = Math.max(0, Math.ceil(page.count / page.size) - 1);
  const pastTheEnd = !loading && page.index > lastPage;
  useEffect(() => {
    if (pastTheEnd) page.onChange(lastPage);
  }, [pastTheEnd, lastPage, page.onChange]);
  if (page.index === 0 && page.count <= page.size) return null;
  const first =
    page.count === 0 ? 0 : Math.min(page.count, page.index * page.size + 1);
  const last = Math.min(page.count, (page.index + 1) * page.size);
  return (
    <nav
      aria-label={labels?.pages ?? 'Pages'}
      className="flex flex-wrap items-center justify-between gap-inline px-inset"
    >
      <Text size="sm" variant="muted" aria-live="polite">
        {labels?.range?.(first, last, page.count) ??
          `${first}–${last} of ${page.count}`}
      </Text>
      <div className="flex gap-inline">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || page.index <= 0}
          onClick={() => page.onChange(page.index - 1)}
        >
          {labels?.previous ?? 'Previous'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || last >= page.count}
          onClick={() => page.onChange(page.index + 1)}
        >
          {labels?.next ?? 'Next'}
        </Button>
      </div>
    </nav>
  );
}

export type CollectionSort = { column: string; ascending: boolean };

export function SortControl({
  options,
  value,
  onChange,
  labels,
}: {
  options: { value: string; label: string }[];
  value?: CollectionSort | null;
  onChange: (sort: CollectionSort) => void;
  labels?: {
    sort?: string;
    choose?: string;
    ascending?: string;
    descending?: string;
  };
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-inline">
      <Label htmlFor={id}>{labels?.sort ?? 'Sort by'}</Label>
      <Select
        value={value?.column ?? ''}
        onValueChange={(column) =>
          onChange({ column, ascending: value?.ascending ?? true })
        }
      >
        <SelectTrigger id={id} size="sm" className="w-auto min-w-0 max-w-full">
          <SelectValue placeholder={labels?.choose ?? 'Choose column'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!value}
        onClick={() =>
          value && onChange({ ...value, ascending: !value.ascending })
        }
      >
        {value?.ascending === false
          ? (labels?.descending ?? 'Descending')
          : (labels?.ascending ?? 'Ascending')}
      </Button>
    </div>
  );
}

export type BulkActionBarLabels = {
  selection: string;
  selected: (count: number, scope: 'page' | 'all') => string;
  clear: string;
  selectAll: (count: number) => string;
};

/** The caller owns selection across pages and whether all matching records are selected. */
export function BulkActionBar({
  count,
  scope = 'page',
  totalCount,
  onClear,
  onSelectAll,
  children,
  labels,
}: {
  count: number;
  scope?: 'page' | 'all';
  totalCount?: number;
  onClear: () => void;
  onSelectAll?: () => void;
  children?: ReactNode;
  labels?: Partial<BulkActionBarLabels>;
}) {
  if (count === 0) return null;
  return (
    <section
      aria-label={labels?.selection ?? 'Selected records'}
      className="flex flex-wrap items-center gap-inline rounded-md border bg-muted p-inline"
    >
      <span role="status" className="text-sm">
        {labels?.selected?.(count, scope) ??
          `${count} selected ${scope === 'all' ? 'across all results' : 'on loaded pages'}`}
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        {labels?.clear ?? 'Clear selection'}
      </Button>
      {scope !== 'all' &&
        onSelectAll &&
        totalCount !== undefined &&
        totalCount > count && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSelectAll}
          >
            {labels?.selectAll?.(totalCount) ??
              `Select all ${totalCount} matching records`}
          </Button>
        )}
      {children}
    </section>
  );
}

/** The caller owns live updates and refresh requests. */
export function CollectionLiveControl({
  enabled,
  onEnabledChange,
  onRefresh,
  refreshing = false,
  labels,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  labels?: { live?: string; refresh?: string; refreshing?: string };
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-inline">
      <Switch id={id} checked={enabled} onCheckedChange={onEnabledChange} />
      <Label htmlFor={id}>{labels?.live ?? 'Live updates'}</Label>
      {!enabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing
            ? (labels?.refreshing ?? 'Refreshing…')
            : (labels?.refresh ?? 'Refresh')}
        </Button>
      )}
    </div>
  );
}
