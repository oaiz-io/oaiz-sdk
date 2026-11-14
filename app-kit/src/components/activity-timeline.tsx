import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { ARRIVAL_CLASS, useArrivals } from '../hooks/use-arrivals';
import { formatDateTime, formatRelative } from '../lib/format';
import { cn } from '../lib/utils';
import { RecordMark } from './record-name';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Textarea } from './ui/textarea';

export type ActivityItem = {
  id: string | number;
  /** Who did it, by name. */
  actor: string;
  /** When it happened: a Date, an ISO timestamp or epoch milliseconds. */
  at: Date | string | number;
} & (
  | { kind: 'comment'; body: ReactNode }
  /** A change, written as what happened, such as "moved this to Proposal". */
  | { kind: 'change'; summary: ReactNode }
);

export type ActivityTimelineProps = {
  /** Oldest first, as a conversation reads. */
  items: ActivityItem[];
  /** Adds a comment box; resolve it once the comment is saved, reject it to keep the text. */
  onComment?: (body: string) => Promise<unknown>;
  /** Shown when there is nothing yet. */
  empty?: ReactNode;
  className?: string;
  locale?: string;
  labels?: Partial<ActivityLabels>;
};

export type ActivityLabels = {
  activity: string;
  empty: string;
  comment: string;
  placeholder: string;
  saving: string;
  saveError: string;
};
const defaults: ActivityLabels = {
  activity: 'Activity',
  empty: 'No activity yet.',
  comment: 'Comment',
  placeholder: 'Leave a comment…',
  saving: 'Saving…',
  saveError: 'The comment was not saved. Try again.',
};

/**
 * What happened to one record, oldest first: comments as messages and changes as one quiet line,
 * each with how long ago, and the exact time on hover. With `onComment` a box under it adds a
 * comment; ⌘ or Ctrl and Enter sends it.
 */
export function ActivityTimeline({
  items,
  onComment,
  empty,
  className,
  locale,
  labels: suppliedLabels,
}: ActivityTimelineProps) {
  const labels = { ...defaults, ...suppliedLabels };
  const arrived = useArrivals(items.map((item) => item.id));
  return (
    <section
      aria-label={labels.activity}
      className={cn('flex flex-col gap-stack', className)}
    >
      {items.length === 0 ? (
        <Text size="sm" variant="muted">
          {empty ?? labels.empty}
        </Text>
      ) : (
        <ol className="flex flex-col">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                'relative flex gap-inline pb-stack last:pb-0',
                arrived(item.id) && ARRIVAL_CLASS,
              )}
            >
              {index < items.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-6 bottom-0 left-0 flex w-5 justify-center"
                >
                  <span className="w-px bg-border" />
                </span>
              )}
              <span className="relative flex size-5 shrink-0 items-center justify-center">
                {item.kind === 'comment' ? (
                  <RecordMark name={item.actor} round />
                ) : (
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-muted-foreground/60 ring-4 ring-background"
                  />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Text
                  size="sm"
                  variant={item.kind === 'change' ? 'muted' : 'default'}
                  className="flex flex-wrap items-baseline gap-x-1.5"
                >
                  <Text as="span" size="sm" weight="medium" variant="default">
                    {item.actor}
                  </Text>
                  {item.kind === 'change' && <span>{item.summary}</span>}
                  <When at={item.at} locale={locale} />
                </Text>
                {item.kind === 'comment' && (
                  <div className="rounded-md bg-muted px-inset py-inline">
                    <Text size="sm" className="whitespace-pre-wrap break-words">
                      {item.body}
                    </Text>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {onComment && <CommentBox onComment={onComment} labels={labels} />}
    </section>
  );
}

/** How long ago, with the exact time on hover; nothing for a time that does not parse. */
function When({ at, locale }: { at: ActivityItem['at']; locale?: string }) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return (
    <Text asChild size="xs" variant="muted">
      <time
        dateTime={date.toISOString()}
        title={formatDateTime(date, { locale })}
      >
        {formatRelative(date, { locale })}
      </time>
    </Text>
  );
}

function CommentBox({
  onComment,
  labels,
}: {
  onComment: (body: string) => Promise<unknown>;
  labels: ActivityLabels;
}) {
  const inFlight = useRef(false);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onComment(text);
      setBody('');
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey) &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <form className="flex flex-col gap-inline" onSubmit={send}>
      <Textarea
        aria-label={labels.comment}
        disabled={pending}
        placeholder={labels.placeholder}
        value={body}
        rows={2}
        onChange={(event) => {
          if (!inFlight.current) setBody(event.target.value);
        }}
        onKeyDown={onKeyDown}
        className="min-h-16 resize-y"
      />
      <div className="flex items-center justify-end gap-inline">
        {failed && (
          <Text
            size="sm"
            variant="destructive"
            role="alert"
            className="mr-auto"
          >
            {labels.saveError}
          </Text>
        )}
        <Button type="submit" size="sm" disabled={!body.trim() || pending}>
          {pending ? labels.saving : labels.comment}
        </Button>
      </div>
    </form>
  );
}
