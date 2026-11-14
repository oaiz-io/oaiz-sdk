import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
} from 'react-resizable-panels';

import { cn } from '../../lib/utils';

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof Group>) => (
  <Group className={cn('relative flex h-full w-full', className)} {...props} />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      'group relative flex w-px items-center justify-center bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:-translate-y-1/2 aria-[orientation=horizontal]:after:translate-x-0 [&[aria-orientation=horizontal]>div]:rotate-90',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="pointer-events-none absolute left-1/2 z-10 flex h-10 w-4 -translate-x-[45%] flex-col items-center justify-center gap-0.5 rounded-full border border-border/40 bg-muted/60 [clip-path:inset(0_0_0_50%)] transition-colors group-hover:bg-muted group-hover:border-border/60">
        <span className="h-1 w-1 translate-x-0.5 rounded-full bg-muted-foreground/70" />
        <span className="h-1 w-1 translate-x-0.5 rounded-full bg-muted-foreground/70" />
        <span className="h-1 w-1 translate-x-0.5 rounded-full bg-muted-foreground/70" />
      </div>
    )}
  </Separator>
);

export {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type PanelImperativeHandle,
};
