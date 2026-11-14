import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '../lib/utils';
import type { PropertyOption } from './property-picker';
import { SplitView } from './split-view';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Heading } from './ui/heading';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Text } from './ui/text';

export type PickerGroup = {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  options: (PropertyOption & { disabled?: boolean })[];
};

export type GroupedPickerProps = {
  groups: readonly PickerGroup[];
  /** Option values are unique across groups and remain selected when their group is closed. */
  selected: ReadonlySet<string>;
  onSelectedChange: (selected: Set<string>) => void;
  label: string;
  labels?: {
    groups?: string;
    back?: string;
    search?: string;
    empty?: string;
    chooseGroup?: string;
    selectedCount?: (selected: number, total: number) => string;
  };
  disabled?: boolean;
  className?: string;
};

/** Category navigation and independent choices. Data, selection and removal remain caller-owned. */
export function GroupedPicker({
  groups,
  selected,
  onSelectedChange,
  label,
  labels,
  disabled = false,
  className,
}: GroupedPickerProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const focused = useRef<{ key: string; index: number; kind: string } | null>(
    null,
  );
  const active = groups.find(
    (group) => group.key === activeKey && !group.disabled,
  );
  const query = search.trim().toLocaleLowerCase();
  const options =
    active?.options.filter((option) =>
      [option.label, ...(option.keywords ?? [])].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    ) ?? [];

  // Removing a focused choice returns focus to a surviving neighbour in the same list.
  useLayoutEffect(() => {
    const previous = focused.current;
    if (!previous || !root.current) return;
    const current = Array.from(
      root.current.querySelectorAll<HTMLElement>('[data-picker-key]'),
    ).find((element) => element.dataset.pickerKey === previous.key);
    if (current) return;
    if (document.activeElement !== document.body) return;
    const candidates = Array.from(
      root.current.querySelectorAll<HTMLElement>(
        `[data-picker-kind="${previous.kind}"]:not(:disabled)`,
      ),
    );
    const target =
      candidates[Math.min(previous.index, candidates.length - 1)] ??
      (active
        ? root.current.querySelector<HTMLElement>('input[type="search"]')
        : root.current.querySelector<HTMLElement>(
            '[data-picker-kind="group"]:not(:disabled)',
          ));
    (target ?? root.current).focus();
  }, [groups, activeKey, search]);

  function navigate(event: KeyboardEvent<HTMLElement>, kind: string) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const elements = Array.from(
      root.current?.querySelectorAll<HTMLElement>(
        `[data-picker-kind="${kind}"]:not(:disabled)`,
      ) ?? [],
    );
    const index = elements.indexOf(event.currentTarget);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? elements.length - 1
          : Math.max(
              0,
              Math.min(
                elements.length - 1,
                index + (event.key === 'ArrowDown' ? 1 : -1),
              ),
            );
    event.preventDefault();
    elements[next]?.focus();
  }

  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      tabIndex={-1}
      className={cn('h-96 min-w-0 rounded-md border', className)}
      onFocusCapture={(event) => {
        const target = event.target as HTMLElement;
        const key = target.dataset.pickerKey;
        const kind = target.dataset.pickerKind;
        if (!key || !kind) {
          focused.current = null;
          return;
        }
        const peers = Array.from(
          root.current?.querySelectorAll(
            `[data-picker-kind="${kind}"]:not(:disabled)`,
          ) ?? [],
        );
        focused.current = { key, kind, index: peers.indexOf(target) };
      }}
    >
      <SplitView
        listLabel={labels?.groups ?? label}
        detailLabel={active?.label}
        detailKey={active?.key}
        onBack={() => {
          setActiveKey(null);
          setSearch('');
        }}
        backLabel={labels?.back ?? 'Back to categories'}
        placeholder={
          <Text size="sm" variant="muted" className="p-inset">
            {labels?.chooseGroup ?? 'Choose a category.'}
          </Text>
        }
        list={
          <ul className="flex flex-col gap-1 p-inline">
            {groups.map((group) => (
              <li key={group.key}>
                <Button
                  type="button"
                  variant={active?.key === group.key ? 'secondary' : 'ghost'}
                  disabled={disabled || group.disabled}
                  className="h-auto min-h-11 w-full justify-start whitespace-normal text-left"
                  aria-pressed={active?.key === group.key}
                  data-picker-kind="group"
                  data-picker-key={`group:${group.key}`}
                  onClick={() => {
                    setActiveKey(group.key);
                    setSearch('');
                  }}
                  onKeyDown={(event) => navigate(event, 'group')}
                >
                  {group.icon}
                  <span className="min-w-0 flex-1 break-words">
                    {group.label}
                    <Text as="span" size="xs" variant="muted" className="block">
                      {labels?.selectedCount?.(
                        group.options.filter((option) =>
                          selected.has(option.value),
                        ).length,
                        group.options.length,
                      ) ??
                        `${group.options.filter((option) => selected.has(option.value)).length} / ${group.options.length}`}
                    </Text>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        }
        detail={
          active && (
            <div className="flex min-w-0 flex-col gap-stack p-inset">
              <Heading level={3} size="sm" className="break-words">
                {active.label}
              </Heading>
              <Input
                type="search"
                aria-label={labels?.search ?? 'Search choices'}
                placeholder={labels?.search ?? 'Search choices'}
                value={search}
                disabled={disabled}
                onChange={(event) => setSearch(event.target.value)}
              />
              {options.length === 0 ? (
                <Text size="sm" variant="muted">
                  {labels?.empty ?? 'No choices.'}
                </Text>
              ) : (
                <ul className="flex flex-col gap-inline">
                  {options.map((option) => (
                    <li key={option.value}>
                      <Label className="flex min-h-11 items-center gap-inline">
                        <Checkbox
                          checked={selected.has(option.value)}
                          disabled={disabled || option.disabled}
                          data-picker-kind="option"
                          data-picker-key={`option:${option.value}`}
                          onKeyDown={(event) => navigate(event, 'option')}
                          onCheckedChange={(checked) => {
                            const next = new Set(selected);
                            if (checked === true) next.add(option.value);
                            else next.delete(option.value);
                            onSelectedChange(next);
                          }}
                        />
                        {option.icon}
                        <Text
                          as="span"
                          size="sm"
                          className="min-w-0 break-words"
                        >
                          {option.label}
                        </Text>
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        }
      />
    </div>
  );
}
