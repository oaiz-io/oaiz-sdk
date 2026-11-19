import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Command, defaultFilter } from 'cmdk';
import { ChevronRight, Search } from 'lucide-react';

import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { Text } from './ui/text';

export type CommandPaletteItem = {
  id: string;
  label: string;
  /** More words that find the item, such as a record's other fields. */
  keywords?: string[];
  icon?: ReactNode;
  /** The key that runs it outside the palette, shown at the right, such as "C". */
  shortcut?: string;
  /** Muted text after the label, such as a record's type or domain. */
  hint?: ReactNode;
  /** Shown in the preview pane while the item is active; the pane appears when any item has one. */
  preview?: ReactNode;
  /** Runs the item and closes the palette. */
  onSelect?: () => void;
  /** Opens a page of these items instead, such as "Change status…" → each status. */
  items?: CommandPaletteItem[];
};

export type CommandPaletteGroup = {
  heading: string;
  items: CommandPaletteItem[];
  /** The caller read these items for the search text, so the palette shows them without matching again. */
  searched?: boolean;
};

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandPaletteGroup[];
  placeholder?: string;
  empty?: ReactNode;
  /** What the actions act on, shown above the search, such as the focused issue. */
  context?: ReactNode;
  /** Reports the search text, so the caller can read matching records from OAIZ. */
  onSearchChange?: (search: string) => void;
  /** Runs as the palette closes; prevent its default and focus the control that opened it. */
  onCloseAutoFocus?: (event: Event) => void;
  labels?: Partial<{
    title: string;
    description: string;
    more: string;
    preview: string;
    noPreview: string;
    navigate: string;
    open: string;
    run: string;
    back: string;
    close: string;
  }>;
};

/**
 * True while the reader types in a field or a dialog or menu is open, where single-key shortcuts
 * must not fire.
 */
function typing(target: EventTarget | null): boolean {
  if (
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
    )
  ) {
    return true;
  }
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

/**
 * Calls `handler` when `key` is pressed anywhere on the page. With `mod`, it needs ⌘ on macOS or
 * Ctrl elsewhere. Character shortcuts need focus inside `scope`; without a scope they require Alt.
 * Composition, handled keys, text fields and open overlays keep their own input.
 */
export function useHotkey(
  key: string,
  handler: () => void,
  options: {
    mod?: boolean;
    enabled?: boolean;
    scope?: RefObject<HTMLElement | null>;
  } = {},
) {
  const latest = useRef(handler);
  latest.current = handler;
  const mod = options.mod ?? false;
  const enabled = options.enabled ?? true;
  const scope = options.scope;
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key.toLowerCase() !== key.toLowerCase()
      )
        return;
      const pressed = event.metaKey || event.ctrlKey;
      if (mod) {
        if (!pressed || event.altKey) return;
      } else {
        if (pressed || typing(event.target)) return;
        if (scope) {
          if (
            event.altKey ||
            !(event.target instanceof Node) ||
            !scope.current?.contains(event.target)
          )
            return;
        } else if (key.length === 1 && !event.altKey) return;
      }
      event.preventDefault();
      latest.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [key, mod, enabled, scope]);
}

/**
 * A searchable list of actions and records in a dialog, as ⌘K opens. Arrow
 * keys move and Enter runs the item. An item with `items` opens a page of them; Backspace in an
 * empty search goes back. While searching, page items also match, as "Change status › Done".
 * Open it with `useHotkey('k', …, { mod: true })`.
 */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = 'Type a command or search…',
  empty = 'No results.',
  context,
  onSearchChange,
  onCloseAutoFocus,
  labels,
}: CommandPaletteProps) {
  const [pages, setPages] = useState<CommandPaletteItem[]>([]);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const page = pages[pages.length - 1];
  const searchListener = useRef(onSearchChange);
  searchListener.current = onSearchChange;
  const changeSearch = (next: string) => {
    setSearch(next);
    searchListener.current?.(next);
  };

  // Each opening starts on the first page with an empty search, however the palette was closed.
  useEffect(() => {
    if (!open) {
      setPages([]);
      setSearch('');
      searchListener.current?.('');
    }
  }, [open]);

  function run(item: CommandPaletteItem) {
    if (item.items) {
      setPages((current) => [...current, item]);
      changeSearch('');
      return;
    }
    onOpenChange(false);
    item.onSelect?.();
  }

  const shown: CommandPaletteGroup[] = page
    ? [{ heading: page.label.replace(/…$/, ''), items: page.items ?? [] }]
    : groups;
  // While searching the first page, the items of every page match too.
  const nested: CommandPaletteItem[] =
    !page && search.trim() !== ''
      ? groups.flatMap((group) =>
          group.items.flatMap((parent) =>
            (parent.items ?? []).map((child) => ({
              ...child,
              id: `${parent.id}/${child.id}`,
              label: `${parent.label.replace(/…$/, '')} › ${child.label}`,
            })),
          ),
        )
      : [];
  const all = [...shown.flatMap((group) => group.items), ...nested];
  const activeItem = all.find((item) => valueOf(item) === active);
  const withPreview = all.some((item) => item.preview !== undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/20"
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          // A phone docks it at the top, so the keyboard opens below the results.
          'top-[15%] translate-y-0 gap-0 overflow-hidden p-0 max-mobile:top-0',
          withPreview ? 'max-w-3xl' : 'max-w-xl',
        )}
      >
        <DialogTitle className="sr-only">
          {labels?.title ?? 'Command palette'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {labels?.description ??
            'Search for an action or a record, then press Enter.'}
        </DialogDescription>
        <Command
          label={labels?.title ?? 'Command palette'}
          filter={score}
          value={active}
          onValueChange={setActive}
          className="flex flex-col"
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && search === '' && page) {
              event.preventDefault();
              setPages((current) => current.slice(0, -1));
            }
          }}
        >
          {context && !page && (
            <div className="px-inset pt-inset">
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                {context}
              </span>
            </div>
          )}
          <div className="flex items-center gap-inline border-b px-stack">
            <Search
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            {page && (
              <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {page.label.replace(/…$/, '')}
              </span>
            )}
            <Command.Input
              autoFocus
              value={search}
              onValueChange={changeSearch}
              placeholder={
                page ? `${page.label.replace(/…$/, '')}…` : placeholder
              }
              // 16px text on a phone keeps iOS from zooming into the field.
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground mobile:text-sm"
            />
          </div>
          <div className="flex min-h-0">
            <Command.List className="max-h-96 min-w-0 flex-1 overflow-y-auto p-inline">
              <Command.Empty className="py-section text-center text-sm text-muted-foreground">
                <div role="option" aria-disabled="true" aria-selected="false">
                  {empty}
                </div>
              </Command.Empty>
              {shown.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={group.heading}
                  className={GROUP}
                >
                  {group.items.map((item) => (
                    <Item
                      key={item.id}
                      item={item}
                      onRun={run}
                      searched={group.searched}
                    />
                  ))}
                </Command.Group>
              ))}
              {nested.length > 0 && (
                <Command.Group
                  heading={labels?.more ?? 'More actions'}
                  className={GROUP}
                >
                  {nested.map((item) => (
                    <Item key={item.id} item={item} onRun={run} />
                  ))}
                </Command.Group>
              )}
            </Command.List>
            {withPreview && (
              <aside
                aria-label={labels?.preview ?? 'Preview'}
                className="hidden w-72 shrink-0 overflow-y-auto border-l p-stack text-sm mobile:block"
              >
                {activeItem?.preview ?? (
                  <span className="text-muted-foreground">
                    {labels?.noPreview ?? 'No preview'}
                  </span>
                )}
              </aside>
            )}
          </div>
          <footer className="flex items-center gap-stack border-t px-stack py-2 text-xs text-muted-foreground pointer-coarse:hidden">
            <span className="flex items-center gap-1">
              <Key>↑</Key>
              <Key>↓</Key>
              {labels?.navigate ?? 'Navigate'}
            </span>
            <span className="flex items-center gap-1">
              <Key>↵</Key>
              {activeItem?.items
                ? (labels?.open ?? 'Open')
                : (labels?.run ?? 'Run')}
            </span>
            {page && (
              <span className="flex items-center gap-1">
                <Key>⌫</Key>
                {labels?.back ?? 'Back'}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1">
              <Key>Esc</Key>
              {labels?.close ?? 'Close'}
            </span>
          </footer>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

const GROUP =
  '[&_[cmdk-group-heading]]:px-inline [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground';

const valueOf = (item: CommandPaletteItem) => `${item.label} ${item.id}`;

const SEARCHED = 'oaiz:searched';

/** Ranks items by the search text, and never hides an item of a group the caller searched. */
function score(value: string, search: string, keywords: string[] = []): number {
  const words = keywords.filter((word) => word !== SEARCHED);
  const match = defaultFilter(value, search, words);
  return words.length === keywords.length ? match : Math.max(match, 0.01);
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-muted px-1 font-sans text-xs text-muted-foreground">
      {children}
    </kbd>
  );
}

function Item({
  item,
  onRun,
  searched,
}: {
  item: CommandPaletteItem;
  onRun: (item: CommandPaletteItem) => void;
  searched?: boolean;
}) {
  return (
    <Command.Item
      value={valueOf(item)}
      keywords={searched ? [...(item.keywords ?? []), SEARCHED] : item.keywords}
      onSelect={() => onRun(item)}
      className="flex h-9 cursor-pointer items-center gap-inline rounded-sm px-inline text-sm text-foreground max-mobile:h-11 data-[selected=true]:bg-accent data-[selected=true]:text-foreground"
    >
      {item.icon && (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">
          {item.icon}
        </span>
      )}
      <span className="min-w-0 truncate">{item.label}</span>
      {item.hint && (
        <Text as="span" size="xs" variant="muted" className="min-w-0 truncate">
          {item.hint}
        </Text>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {item.shortcut && (
          <kbd className="rounded-sm border bg-muted px-1.5 font-mono text-xs text-muted-foreground pointer-coarse:hidden">
            {item.shortcut}
          </kbd>
        )}
        {item.items && (
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 text-muted-foreground"
          />
        )}
      </span>
    </Command.Item>
  );
}
