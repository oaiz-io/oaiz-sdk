import { Textarea } from './ui/textarea';
import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  AudioLines,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  Mic,
  MicOff,
  ShieldAlert,
  Square,
  X,
} from 'lucide-react';

import type {
  ChatItem,
  OaizChatStatus,
  OaizChatVoiceControls,
  PendingToolCall,
} from '../hooks/oaiz-chat';
import { cn } from '../lib/utils';
import { ChatMarkdown, useCopy } from './chat-markdown';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Heading } from './ui/heading';
import { OrbSpinner } from './ui/orb-spinner';
import { ShimmerText } from './ui/shimmer-text';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';
import { VoiceOrb } from './ui/voice-orb';

export type ChatPanelProps = {
  items: ChatItem[];
  status: OaizChatStatus;
  onSend: (content: string) => unknown;
  /** Closes the stream, which stops the turn. */
  onStop: () => void;
  /** The greeting above the centred composer of an empty chat. */
  empty?: ReactNode;
  /** Shown below the centred composer of an empty chat, such as suggested questions. */
  emptyFooter?: ReactNode;
  /** The chat's saved messages are loading. */
  loading?: boolean;
  /** Why the last message failed; the row with it offers `onRetry`. */
  error?: { message: string } | null;
  onRetry?: () => void;
  /** The `voice` of `useOaizChat`; the panel offers voice when it is set. */
  voice?: OaizChatVoiceControls | null;
  /**
   * The `pending` call of `useOaizChat`. The panel shows it with `onApprove` and `onDecline`, and
   * sends no message until the member decides.
   */
  pending?: PendingToolCall | null;
  onApprove?: () => void;
  onDecline?: () => void;
  placeholder?: string;
  className?: string;
};

const NEAR_END_PX = 80;

const ROW_TRIGGER =
  'flex w-full min-w-0 items-center gap-inline rounded-lg p-inset text-left text-muted-foreground transition-colors duration-fast ease-move hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const ROW_CHEVRON = 'size-4 shrink-0 transition-transform duration-fast ease-move';
const ROW_SPINNER =
  'size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none';
const HOVER_ACTIONS =
  'mt-1 flex items-center gap-inline transition-opacity duration-fast ease-move group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0';
const STEP_RAIL = 'mt-1 ml-2 flex flex-col gap-3 border-l border-border py-2 pl-6';

type Activity = Extract<ChatItem, { kind: 'reasoning' | 'tool' }>;
type Message = Extract<ChatItem, { kind: 'user' | 'answer' }>;
type TimelineRow = { kind: 'activity'; id: string; steps: Activity[] } | Message;

/** Each run of reasoning and tools between messages becomes one activity row. */
function toTimeline(items: ChatItem[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const item of items) {
    if (item.kind === 'user' || item.kind === 'answer') {
      rows.push(item);
      continue;
    }
    const last = rows[rows.length - 1];
    if (last?.kind === 'activity') last.steps.push(item);
    else rows.push({ kind: 'activity', id: item.id, steps: [item] });
  }
  return rows;
}

function formatDuration(ms: number | undefined): string | null {
  if (!ms || ms <= 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function MessageActions({
  content,
  createdAt,
  align,
}: {
  content: string;
  createdAt?: string;
  align: 'start' | 'end';
}) {
  const { copied, copy } = useCopy();
  const time = createdAt ? (
    <Text asChild size="xs" variant="muted">
      <time dateTime={createdAt}>{formatTime(createdAt)}</time>
    </Text>
  ) : null;
  return (
    <div className={cn(HOVER_ACTIONS, align === 'end' ? 'justify-end' : 'justify-start')}>
      {align === 'end' && time}
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground"
        aria-label={copied ? 'Copied' : 'Copy message'}
        onClick={() => void copy(content)}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      {align === 'start' && time}
    </div>
  );
}

function WorkingLabel({ label }: { label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-inline">
      <OrbSpinner sizePx={20} aria-hidden />
      <ShimmerText appearance="activity" size="sm" className="text-foreground">
        {label}
      </ShimmerText>
    </span>
  );
}

function Json({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div>
      <Text size="xs" variant="muted" className="mb-1">
        {title}
      </Text>
      <pre tabIndex={0} className="max-h-64 overflow-auto rounded-md bg-muted p-inset font-mono text-xs leading-relaxed text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function Disclosure({
  header,
  railClassName,
  children,
  testId,
}: {
  header: ReactNode;
  railClassName: string;
  children?: ReactNode;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  if (!children) {
    return (
      <div
        className="flex w-full min-w-0 items-center gap-inline p-inset pl-[2.25rem] text-muted-foreground"
        data-testid={testId}
      >
        {header}
      </div>
    );
  }
  return (
    <div className="flex w-full min-w-0 flex-col" data-testid={testId}>
      <Button variant="plain" size={null}
        type="button"
        className={ROW_TRIGGER}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight aria-hidden className={cn(ROW_CHEVRON, open && 'rotate-90')} />
        {header}
      </Button>
      {open && <div className={railClassName}>{children}</div>}
    </div>
  );
}

function StepName({ name }: { name: string }) {
  return (
    <Text as="span" weight="medium" variant="muted" className="min-w-0 flex-1 truncate" title={name}>
      {name}
    </Text>
  );
}

function StepMeta({ children }: { children: ReactNode }) {
  return (
    <Text as="span" size="xs" variant="muted" className="shrink-0">
      {children}
    </Text>
  );
}

function ActivityStep({ step }: { step: Activity }) {
  const duration = formatDuration(step.durationMs);
  if (step.kind === 'reasoning') {
    return (
      <Disclosure
        testId="chat-panel-reasoning"
        railClassName={STEP_RAIL}
        header={
          <>
            <StepName name="Reasoning" />
            {step.streaming && <Loader2 className={ROW_SPINNER} />}
            {duration && <StepMeta>{duration}</StepMeta>}
          </>
        }
      >
        {step.content ? (
          <Text as="p" variant="muted" leading="relaxed" className="break-words whitespace-pre-wrap">
            {step.content}
          </Text>
        ) : null}
      </Disclosure>
    );
  }
  return (
    <Disclosure
      testId="chat-panel-tool"
      railClassName={STEP_RAIL}
      header={
        <>
          <StepName name={step.name} />
          {step.state === 'running' && <Loader2 className={ROW_SPINNER} />}
          {step.state === 'stopped' && <StepMeta>Stopped</StepMeta>}
          {step.state === 'waiting' && <StepMeta>Waiting for approval</StepMeta>}
          {step.state === 'failed' && (
            <span className="shrink-0">
              <X aria-hidden className="size-3.5 text-destructive-text" />
              <span className="sr-only">Failed</span>
            </span>
          )}
          {duration && <StepMeta>{duration}</StepMeta>}
        </>
      }
    >
      {step.input || step.output || step.error ? (
        <>
          {step.input && <Json title="Input" value={step.input} />}
          {step.output && <Json title="Output" value={step.output} />}
          {step.error && (
            <Text as="p" variant="destructive" className="break-words">
              {step.error}
            </Text>
          )}
        </>
      ) : null}
    </Disclosure>
  );
}

function ActivityRow({ steps, active }: { steps: Activity[]; active: boolean }) {
  const last = steps[steps.length - 1];
  const ending =
    last?.kind === 'tool' && last.state === 'waiting'
      ? 'Waiting for approval'
      : last?.kind === 'tool' && last.state === 'stopped'
        ? 'Stopped'
        : 'Completed';
  return (
    <div className="mb-2 flex w-full">
      <Disclosure
        testId="chat-panel-activity"
        railClassName="mt-1 ml-2 max-h-[25rem] scrollbar-none overflow-y-auto overscroll-contain border-l border-border pr-0.5 pl-2"
        header={
          active ? (
            <WorkingLabel label="Working.." />
          ) : (
            <>
              <Text as="span" weight="medium" variant="muted" className="min-w-0 truncate">
                {`${ending} · ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`}
              </Text>
              {last?.kind === 'tool' && last.state === 'failed' && (
                <span className="shrink-0">
                  <X aria-hidden className="size-3.5 text-muted-foreground" />
                  <span className="sr-only">The last step failed</span>
                </span>
              )}
            </>
          )
        }
      >
        {steps.map((step) => (
          <ActivityStep key={step.id} step={step} />
        ))}
      </Disclosure>
    </div>
  );
}

const MessageRow = memo(function MessageRow({ item }: { item: Message }) {
  if (item.kind === 'user') {
    return (
      <div
        className="group mb-chat-message-gap flex w-full justify-end"
        data-testid="chat-panel-user"
      >
        <div className="ml-8 flex max-w-[calc(100%-2rem)] min-w-0 flex-col mobile:max-w-[85%]">
          <div className="max-w-[37.5rem] rounded-lg bg-muted p-inset break-words">
            <Text as="div" leading="relaxed" className="whitespace-pre-wrap">
              {item.content}
            </Text>
          </div>
          <MessageActions content={item.content} createdAt={item.createdAt} align="end" />
        </div>
      </div>
    );
  }
  return (
    <div
      className="group mb-chat-message-gap flex w-full justify-start"
      data-testid="chat-panel-answer"
      aria-busy={item.streaming}
    >
      <div className="mr-8 flex min-w-0 flex-1 flex-col break-words">
        <ChatMarkdown content={item.content} streaming={item.streaming} />
        {!item.streaming && (
          <MessageActions content={item.content} createdAt={item.createdAt} align="start" />
        )}
      </div>
    </div>
  );
});

function ApprovalRow({
  call,
  deciding,
  onApprove,
  onDecline,
}: {
  call: PendingToolCall;
  /** A decision on the call is on its way. */
  deciding: boolean;
  onApprove?: () => void;
  onDecline?: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Tool call waiting for approval"
      className="mb-chat-message-gap flex flex-col gap-inline rounded-lg border border-warning-text/50 bg-warning-bg-subtle p-inset"
      data-testid="chat-panel-approval"
    >
      <div className="flex items-center gap-inline">
        <ShieldAlert aria-hidden className="size-4 shrink-0 text-warning-text" />
        <Text as="span" weight="medium" className="min-w-0 truncate">
          {`Run ${call.displayName || call.toolName}?`}
        </Text>
      </div>
      <Text size="sm" variant="muted">
        The agent waits for your decision. The call runs only if you approve it.
      </Text>
      <Json title="Input" value={call.args} />
      <div className="flex justify-end gap-inline">
        <Button variant="outline" size="sm" onClick={onDecline} disabled={deciding} data-testid="chat-panel-decline">
          <X /> Decline
        </Button>
        <Button size="sm" onClick={onApprove} disabled={deciding} data-testid="chat-panel-approve">
          <Check /> Approve
        </Button>
      </div>
    </div>
  );
}

function ChatError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mb-chat-message-gap flex w-full max-w-full items-start gap-3 mobile:max-w-[85%]"
    >
      <Avatar className="mt-1 size-8 shrink-0">
        <AvatarFallback className="border border-destructive-text bg-destructive-bg-subtle text-destructive-text">
          <AlertCircle className="size-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col items-start gap-inline">
        <div className="rounded-lg border border-destructive-text bg-destructive-bg-subtle p-inset">
          <Text
            as="div"
            variant="destructive"
            leading="relaxed"
            className="break-words whitespace-pre-wrap"
          >
            {message}
          </Text>
        </div>
        {onRetry && (
          <Button variant="outline" size="xs" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

/** The line the voice model is speaking right now. */
function VoiceTranscript({ speech }: { speech: string }) {
  if (!speech) return null;
  return (
    <p
      className="max-h-24 min-w-0 flex-1 overflow-y-auto py-1 text-sm text-muted-foreground"
      aria-live="polite"
      data-testid="chat-panel-voice-transcript"
    >
      <span className="sr-only">Said aloud: </span>
      {speech}
    </p>
  );
}

/** Starts the call on an empty composer, and ends a call in progress. */
function VoiceButton({ voice, loading }: { voice: OaizChatVoiceControls; loading: boolean }) {
  const { state } = voice;
  const live = state === 'live';
  const pending = state === 'connecting' || state === 'closing';
  const label =
    state === 'connecting'
      ? 'Connecting the voice conversation'
      : live
        ? 'End'
        : state === 'closing'
          ? 'Ending the voice conversation'
          : 'Start a voice conversation';
  return (
    <Button
      type="button"
      variant={live ? 'default' : 'ghost'}
      size="icon"
      disabled={state === 'closing' || (state === 'idle' && loading)}
      aria-label={label}
      aria-pressed={live}
      aria-busy={pending}
      className={cn(
        'size-10 shrink-0 half:size-8',
        live
          ? 'rounded-full bg-foreground p-0 text-background shadow-sm hover:bg-foreground/90'
          : 'rounded-md text-foreground hover:bg-transparent hover:text-foreground',
      )}
      data-testid="chat-panel-voice"
      onClick={(event) => {
        event.stopPropagation();
        if (state === 'idle') void voice.start();
        else voice.stop();
      }}
    >
      {pending ? (
        <Loader2 className="animate-spin motion-reduce:animate-none" />
      ) : live ? (
        <Square className="!size-3.5 fill-current" />
      ) : (
        <AudioLines />
      )}
    </Button>
  );
}

/**
 * A chat in the style of OAIZ chat. It fills its parent, so give the parent a height. An empty chat
 * centres its composer below `empty`. Each run of reasoning and tools collapses into one row, and
 * the answer streams as Markdown. Enter sends, Shift+Enter starts a new line, and the send button
 * stops the turn while the agent works. With `voice`, an empty composer offers a call instead, and
 * during a call it holds the End control. The view stays on the newest row unless the member
 * scrolls up, and then a button leads back.
 */
export function ChatPanel({
  items,
  status,
  onSend,
  onStop,
  empty,
  emptyFooter,
  loading = false,
  error,
  onRetry,
  voice,
  pending,
  onApprove,
  onDecline,
  placeholder = 'Ask a question',
  className,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [awayFromEnd, setAwayFromEnd] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const followNewest = useRef(true);
  const working = status !== 'idle';
  const hasDraft = draft.trim() !== '';
  const voiceState = voice?.state ?? 'idle';
  const inCall = voiceState !== 'idle';
  const callChanging = voiceState === 'connecting' || voiceState === 'closing';
  const deciding = pending != null;
  const canSend = hasDraft && !loading && !callChanging && !deciding;
  // A spoken request runs as a chat turn, so the agent works for most of a call, and the member
  // must still be able to hang up. Starting a call still defers to a draft or a running turn.
  const showVoiceButton = voice != null && !hasDraft && (inCall || (!working && !deciding));
  const rows = toTimeline(items);
  const lastRow = rows[rows.length - 1];
  const activeRun = working && lastRow?.kind === 'activity';
  const centred = items.length === 0 && !working && !loading && !error && !voice?.error && !deciding;

  useLayoutEffect(() => {
    if (scroller.current && followNewest.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  });

  useLayoutEffect(() => {
    if (!input.current) return;
    input.current.style.height = 'auto';
    input.current.style.height = `${input.current.scrollHeight}px`;
  }, [draft]);

  function submit() {
    const content = draft.trim();
    // A call runs its messages one after the other, so a message typed during a turn waits for it.
    if (content === '' || (working && !inCall) || loading || callChanging || deciding) return;
    followNewest.current = true;
    setAwayFromEnd(false);
    setDraft('');
    onSend(content);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) onStop();
    else submit();
    input.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  // The scroll handler resumes following on arrival; a render before that would cut the motion short.
  function scrollToEnd() {
    // A scroll option overrides CSS scroll-behavior, so reduced motion is read here.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }

  const composer = (
    <form className="relative w-full" onSubmit={handleSubmit} data-testid="chat-panel-composer">
      {awayFromEnd && !centred && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute -top-12 left-1/2 z-20 size-8 -translate-x-1/2 rounded-full border-border/60 bg-background/95 shadow-lg backdrop-blur-sm hover:bg-background hover:shadow-xl"
          aria-label="Scroll to the latest message"
          data-testid="chat-panel-scroll-to-latest"
          onClick={scrollToEnd}
        >
          <ArrowDown />
        </Button>
      )}
      <div
        className="flex w-full cursor-text flex-col gap-inline rounded-lg border border-border bg-card p-inset shadow-xs"
        onClick={() => input.current?.focus()}
      >
        {voice && inCall && !centred && (
          <div className="flex w-full items-center gap-inline" data-testid="chat-panel-voice-composer">
            <VoiceOrb size="composer" state={voiceState} outputAnalyser={voice.outputAnalyser} />
            <VoiceTranscript speech={voice.assistantSpeech} />
          </div>
        )}
        <div className="flex w-full items-start gap-inline">
          <Textarea
            ref={input}
            rows={1}
            value={draft}
            placeholder={placeholder}
            aria-label={placeholder}
            className="max-h-60 min-h-8 min-w-0 flex-1 resize-none"
            data-testid="chat-panel-input"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          {voice && inCall && voiceState !== 'closing' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={voice.muted ? 'Unmute microphone' : 'Mute microphone'}
              aria-pressed={voice.muted}
              className={cn(
                'size-10 shrink-0 rounded-md half:size-8',
                voice.muted ? 'text-muted-foreground hover:text-foreground' : 'text-foreground hover:text-foreground',
              )}
              data-testid="chat-panel-voice-mute"
              onClick={(event) => {
                event.stopPropagation();
                voice.toggleMute();
              }}
            >
              {voice.muted ? <MicOff /> : <Mic />}
            </Button>
          )}
          {voice && showVoiceButton ? (
            <VoiceButton voice={voice} loading={loading} />
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={!working && !canSend}
              aria-label={working ? 'Stop' : 'Send'}
              className={cn(
                'size-10 shrink-0 rounded-full p-0 shadow-sm transition-all duration-normal half:size-8',
                working || canSend
                  ? 'bg-foreground text-background hover:bg-foreground/90'
                  : 'border border-border/60 bg-background text-muted-foreground hover:bg-background disabled:opacity-100',
                canSend && !working && 'hover:scale-105',
              )}
              data-testid="chat-panel-submit"
            >
              {working ? <Square className="!size-3.5 fill-current" /> : <ArrowUp className="!size-5" />}
            </Button>
          )}
        </div>
      </div>
    </form>
  );

  // One tree for both layouts, so the composer keeps its focus when the first message docks it.
  return (
    <div
      ref={scroller}
      role="group"
      aria-label="Chat"
      tabIndex={0}
      className={cn(
        'flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        centred && 'justify-center',
        className,
      )}
      data-testid="chat-panel"
      onScroll={({ currentTarget: { scrollHeight, scrollTop, clientHeight } }) => {
        const nearEnd = scrollHeight - scrollTop - clientHeight < NEAR_END_PX;
        followNewest.current = nearEnd;
        setAwayFromEnd(!nearEnd);
      }}
    >
      {centred && voice && inCall ? (
        <div
          className="mx-auto mb-stack flex w-full max-w-3xl flex-col items-center gap-3 px-3 text-center half:mb-6 half:px-4"
          data-testid="chat-panel-voice-stage"
        >
          <VoiceOrb size="stage" state={voiceState} outputAnalyser={voice.outputAnalyser} />
          <Heading level={1}>I&apos;m listening.</Heading>
          <VoiceTranscript speech={voice.assistantSpeech} />
        </div>
      ) : (
        centred &&
        empty && (
          <div
            className="mx-auto mb-stack flex w-full max-w-3xl flex-col items-center gap-1 px-3 text-center half:mb-6 half:px-4"
            data-testid="chat-panel-empty"
          >
            {empty}
          </div>
        )
      )}
      <div className={cn('w-full flex-1 px-3 pt-stack half:px-4', centred && 'hidden')}>
        <div
          role="log"
          aria-label="Conversation"
          aria-busy={working || loading}
          className="mx-auto flex min-h-full w-full max-w-3xl flex-col"
        >
          {loading ? (
            <div className="flex flex-col gap-stack" data-testid="chat-panel-loading">
              <Skeleton className="ml-auto h-11 w-2/5 rounded-lg" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="mt-stack ml-auto h-11 w-1/3 rounded-lg" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <>
              {rows.map((row) =>
                row.kind === 'activity' ? (
                  <ActivityRow
                    key={row.id}
                    steps={row.steps}
                    active={activeRun && row === lastRow}
                  />
                ) : (
                  <MessageRow key={row.id} item={row} />
                ),
              )}
              {pending && (
                <ApprovalRow call={pending} deciding={working} onApprove={onApprove} onDecline={onDecline} />
              )}
              {status === 'waiting' && !activeRun && (
                <div className="mb-2 flex items-center p-inset" data-testid="chat-panel-waiting">
                  <WorkingLabel label="Thinking" />
                </div>
              )}
              {error && (
                <ChatError message={error.message} onRetry={working || inCall ? undefined : onRetry} />
              )}
              {voice?.error && <ChatError message={voice.error.message} />}
            </>
          )}
        </div>
      </div>
      <div
        className={cn(
          'flex shrink-0 justify-center bg-background px-3 half:px-4',
          !centred && 'sticky bottom-0 z-30 pb-3 half:pb-4',
        )}
      >
        {!centred && (
          <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-background to-transparent" />
        )}
        <div className="w-full max-w-3xl">{composer}</div>
      </div>
      {centred && !inCall && emptyFooter && (
        <div className="mx-auto mt-stack flex w-full max-w-3xl flex-col items-center px-3 half:px-4">
          {emptyFooter}
        </div>
      )}
    </div>
  );
}
