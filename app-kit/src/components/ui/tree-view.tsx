import * as React from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Text } from './text';

export interface TreeNode {
  id: string;
  label: React.ReactNode;
  /** The text a screen reader and type-ahead use when `label` is not plain text. */
  textValue?: string;
  icon?: React.ReactNode;
  /** Shown after the label, such as a count. */
  meta?: React.ReactNode;
  children?: TreeNode[];
}

export interface TreeViewProps {
  nodes: TreeNode[];
  /** Names the tree, such as "Folders". */
  label: string;
  /** The chosen node's id. */
  selected?: string | null;
  onSelect?: (node: TreeNode) => void;
  /** The ids of nodes open at first. */
  defaultExpanded?: string[];
  className?: string;
}

interface Row {
  node: TreeNode;
  level: number;
  parent: string | null;
  open: boolean;
}

function visibleRows(
  nodes: TreeNode[],
  expanded: Set<string>,
  level = 1,
  parent: string | null = null,
): Row[] {
  return nodes.flatMap((node) => {
    const open = expanded.has(node.id);
    const row = { node, level, parent, open };
    return node.children?.length && open
      ? [row, ...visibleRows(node.children, expanded, level + 1, node.id)]
      : [row];
  });
}

const textOf = (node: TreeNode) =>
  node.textValue ?? (typeof node.label === 'string' ? node.label : node.id);

/**
 * Nested items, such as folders, categories or org units, in the WAI-ARIA tree pattern. Arrow
 * keys move and open, Home and End jump, Enter or Space choose, and typing a letter finds the
 * next item that starts with it.
 */
function TreeView({
  nodes,
  label,
  selected = null,
  onSelect,
  defaultExpanded = [],
  className,
}: TreeViewProps) {
  const [expanded, setExpanded] = React.useState(
    () => new Set(defaultExpanded),
  );
  const [focused, setFocused] = React.useState<string | null>(null);
  const refs = React.useRef(new Map<string, HTMLDivElement>());
  const rows = visibleRows(nodes, expanded);
  const current = focused ?? selected ?? rows[0]?.node.id ?? null;

  const focus = (id: string | undefined) => {
    if (!id) return;
    setFocused(id);
    refs.current.get(id)?.focus();
  };
  const toggle = (id: string, open: boolean) =>
    setExpanded((now) => {
      const next = new Set(now);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  function onKeyDown(event: React.KeyboardEvent, row: Row, index: number) {
    const hasChildren = Boolean(row.node.children?.length);
    switch (event.key) {
      case 'ArrowDown':
        focus(rows[index + 1]?.node.id);
        break;
      case 'ArrowUp':
        focus(rows[index - 1]?.node.id);
        break;
      case 'ArrowRight':
        if (hasChildren && !row.open) toggle(row.node.id, true);
        else if (hasChildren) focus(rows[index + 1]?.node.id);
        break;
      case 'ArrowLeft':
        if (hasChildren && row.open) toggle(row.node.id, false);
        else focus(row.parent ?? undefined);
        break;
      case 'Home':
        focus(rows[0]?.node.id);
        break;
      case 'End':
        focus(rows[rows.length - 1]?.node.id);
        break;
      case 'Enter':
      case ' ':
        onSelect?.(row.node);
        if (hasChildren && !onSelect) toggle(row.node.id, !row.open);
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const key = event.key.toLowerCase();
          const after = [...rows.slice(index + 1), ...rows.slice(0, index)];
          focus(
            after.find((each) =>
              textOf(each.node).toLowerCase().startsWith(key),
            )?.node.id,
          );
          break;
        }
        return;
    }
    event.preventDefault();
  }

  return (
    <div
      role="tree"
      aria-label={label}
      className={cn('flex flex-col', className)}
    >
      {rows.map((row, index) => {
        const hasChildren = Boolean(row.node.children?.length);
        const isSelected = row.node.id === selected;
        return (
          <div
            key={row.node.id}
            ref={(element) => {
              if (element) refs.current.set(row.node.id, element);
              else refs.current.delete(row.node.id);
            }}
            role="treeitem"
            aria-level={row.level}
            aria-expanded={hasChildren ? row.open : undefined}
            aria-selected={onSelect ? isSelected : undefined}
            aria-label={textOf(row.node)}
            tabIndex={row.node.id === current ? 0 : -1}
            onFocus={() => setFocused(row.node.id)}
            onKeyDown={(event) => onKeyDown(event, row, index)}
            onClick={() => {
              setFocused(row.node.id);
              if (onSelect) onSelect(row.node);
              else if (hasChildren) toggle(row.node.id, !row.open);
            }}
            // Each level indents by one stack step from the inline gutter.
            style={{
              paddingInlineStart: `calc(var(--spacing-inline) + ${row.level - 1} * var(--spacing-stack))`,
            }}
            className={cn(
              'flex cursor-pointer select-none items-center gap-1.5 rounded-sm py-1.5 pr-inline outline-none transition-colors duration-fast ease-move hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring max-mobile:py-inset [&_svg]:size-4 [&_svg]:shrink-0',
              isSelected && 'bg-accent text-accent-foreground',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4 items-center justify-center text-muted-foreground',
                !hasChildren && 'invisible',
              )}
              onClick={(event) => {
                if (!hasChildren) return;
                event.stopPropagation();
                toggle(row.node.id, !row.open);
              }}
            >
              <ChevronRight
                className={cn(
                  'transition-transform duration-fast ease-move',
                  row.open && 'rotate-90',
                )}
              />
            </span>
            {row.node.icon && (
              <span aria-hidden="true" className="flex text-muted-foreground">
                {row.node.icon}
              </span>
            )}
            <Text as="span" className="min-w-0 flex-1 truncate">
              {row.node.label}
            </Text>
            {row.node.meta !== undefined && (
              <Text
                as="span"
                size="xs"
                variant="muted"
                className="shrink-0 tabular-nums"
              >
                {row.node.meta}
              </Text>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { TreeView };
