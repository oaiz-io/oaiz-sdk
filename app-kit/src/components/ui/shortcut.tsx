import { cn } from '../../lib/utils';
import { Text } from './text';

/**
 * A single key in a keyboard shortcut. Renders a `<kbd>` element, so the
 * markup stays semantic even though the component is named for its purpose.
 */
function ShortcutKey({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <Text
      asChild
      size="xs"
      weight="medium"
      variant="muted"
      leading="none"
      className={cn(
        'pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm bg-muted px-1',
        "[&_svg:not([class*='size-'])]:size-3",
        '[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10',
        className,
      )}
    >
      <kbd data-slot="shortcut-key" {...props} />
    </Text>
  );
}

/** Groups the keys of one shortcut, e.g. ⌘ + K. */
function Shortcut({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <kbd
      data-slot="shortcut"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  );
}

export { ShortcutKey, Shortcut };
