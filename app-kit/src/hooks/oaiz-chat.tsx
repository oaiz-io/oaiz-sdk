import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { OaizChat, OaizChatMessage, OaizError, OaizVoiceSnapshot, OaizVoiceTurn, OaizVoiceTurnSource } from '@oaiz/sdk';

/** One event of a turn's stream, as `client.chat.send` yields it. */
export type OaizChatEvent =
  ReturnType<OaizChat['send']> extends AsyncIterable<infer Frame extends { data: unknown }>
    ? NonNullable<Frame['data']>
    : never;

type ChatMessageRow = NonNullable<OaizChatEvent['message']>;

/** `waiting`: the call has not run and waits for the member's decision. */
export type ChatToolState = 'running' | 'done' | 'failed' | 'stopped' | 'waiting';

/** A tool call the turn stopped on: it has not run, and runs only when the member approves it. */
export type PendingToolCall = {
  toolCallId: string;
  toolName: string;
  /** The call's label shown to people. */
  displayName?: string;
  /** The arguments the call runs with when approved. */
  args: Record<string, unknown>;
};

/** One row of a chat: a member's message, an agent's answer, its reasoning, or a tool it called. */
export type ChatItem =
  | { kind: 'user'; id: string; content: string; createdAt?: string }
  | { kind: 'answer'; id: string; content: string; streaming: boolean; createdAt?: string }
  | { kind: 'reasoning'; id: string; content: string; streaming: boolean; durationMs?: number }
  | {
      kind: 'tool';
      id: string;
      name: string;
      state: ChatToolState;
      durationMs?: number;
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      error?: string;
    };

/** `waiting`: the agent works and writes nothing yet. `streaming`: the answer is arriving. */
export type OaizChatStatus = 'idle' | 'waiting' | 'streaming';

export type OaizChatState = {
  items: ChatItem[];
  status: OaizChatStatus;
  /** The chat to continue; `null` until `session.created` names a new chat. */
  sessionId: string | null;
  /** The saved messages of `sessionId` are loading. */
  loading: boolean;
  /** Why the last message or the last load failed. */
  error: OaizError | null;
  /** The call the turn stopped on, until the member approves or declines it. A message waits for it. */
  pending: PendingToolCall | null;
};

const NEW_CHAT: OaizChatState = {
  items: [],
  status: 'idle',
  sessionId: null,
  loading: false,
  error: null,
  pending: null,
};

function toolLabel(toolName: string | undefined): string {
  if (!toolName) return 'Tool';
  const words = toolName.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A tool's result without the fields OAIZ adds to every result. */
function toolOutput(result: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!result) return undefined;
  const { durationMs: _durationMs, cost: _cost, ...output } = result;
  return output;
}

function toItem(message: ChatMessageRow): ChatItem | null {
  const { id, content, createdAt, latencyMs } = message;
  if (message.role === 'user') {
    return message.messageType === undefined || message.messageType === 'user_input'
      ? { kind: 'user', id, content, createdAt }
      : null;
  }
  switch (message.messageType) {
    case 'ai_response':
      return { kind: 'answer', id, content, streaming: false, createdAt };
    case 'thinking':
      return { kind: 'reasoning', id, content, streaming: false, durationMs: latencyMs };
    case 'tool_started':
    case 'tool_finished': {
      const call = message.artifacts?.find((artifact) => artifact.toolCallResult)?.toolCallResult;
      const name = call?.displayName || toolLabel(call?.toolName);
      const finished = message.messageType === 'tool_finished';
      const durationMs = call?.result?.durationMs;
      return {
        kind: 'tool',
        id,
        name,
        state: !finished ? 'running' : call?.success === false ? 'failed' : 'done',
        durationMs: typeof durationMs === 'number' ? durationMs : undefined,
        input: call?.args,
        output: finished ? toolOutput(call?.result) : undefined,
        error: finished ? call?.error : undefined,
      };
    }
    default:
      return null;
  }
}

function upsert(items: ChatItem[], item: ChatItem, clientMessageId?: string): ChatItem[] {
  const index = items.findIndex(
    (each) => each.id === item.id || each.id === clientMessageId,
  );
  if (index < 0) return [...items, item];
  return items.map((each, at) => (at === index ? item : each));
}

/**
 * Ends what a turn left open: unfinished text stops streaming, and a running tool has stopped. When
 * the last turn stopped on a call for the member's decision, that turn's unfinished calls wait.
 */
function settled(items: ChatItem[], awaitingDecision = false): ChatItem[] {
  const lastTurn = awaitingDecision ? items.map((item) => item.kind).lastIndexOf('user') + 1 : items.length;
  return items.map((item, at) => {
    if ((item.kind === 'answer' || item.kind === 'reasoning') && item.streaming) {
      return { ...item, streaming: false };
    }
    if (item.kind === 'tool' && item.state === 'running') {
      return { ...item, state: at >= lastTurn ? 'waiting' : 'stopped' };
    }
    return item;
  });
}

function toPendingToolCall(call: {
  toolCallId?: string | null;
  toolName?: string | null;
  displayName?: string | null;
  args?: Record<string, unknown> | null;
}): PendingToolCall | null {
  if (!call.toolCallId || !call.toolName) return null;
  return {
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    displayName: call.displayName || undefined,
    args: call.args ?? {},
  };
}

function applyDelta(
  state: OaizChatState,
  delta: NonNullable<OaizChatEvent['delta']>,
  messageId: string,
): OaizChatState {
  const known = state.items.find((item) => item.id === messageId);
  const before = known?.kind === 'answer' || known?.kind === 'reasoning' ? known.content : '';
  const content = before + (delta.content ?? '');
  const streaming = !delta.isFinal;
  if (delta.targetType === 'thinking') {
    return {
      ...state,
      items: upsert(state.items, {
        kind: 'reasoning',
        id: messageId,
        content,
        streaming,
        durationMs: delta.latencyMs ?? undefined,
      }),
    };
  }
  return {
    ...state,
    items: upsert(state.items, {
      kind: 'answer',
      id: messageId,
      content,
      streaming,
      createdAt: known?.kind === 'answer' ? known.createdAt : new Date().toISOString(),
    }),
    status: 'streaming',
  };
}

/** The chat after one event of a turn's stream. Events a chat does not display change nothing. */
export function applyChatEvent(state: OaizChatState, event: OaizChatEvent): OaizChatState {
  switch (event.type) {
    case 'session.created':
      return event.sessionId ? { ...state, sessionId: event.sessionId } : state;
    case 'message.created':
    case 'message.updated': {
      const item = event.message ? toItem(event.message) : null;
      if (item === null) return state;
      return {
        ...state,
        items: upsert(state.items, item, event.message?.clientMessageId),
        status: item.kind === 'tool' ? 'waiting' : state.status,
      };
    }
    case 'generation.started':
      // A decision's turn starts only once OAIZ has taken the decision.
      return state.pending ? { ...state, pending: null } : state;
    case 'tool.approvalRequired':
      return event.toolApprovalInfo
        ? { ...state, pending: toPendingToolCall(event.toolApprovalInfo) }
        : state;
    case 'message.delta':
      return event.delta?.messageId
        ? applyDelta(state, event.delta, event.delta.messageId)
        : state;
    case 'error':
      return {
        ...state,
        error: {
          message: event.error?.message ?? 'The agent could not answer.',
          code: event.error?.code ?? '',
          hints: [],
        },
      };
    default:
      return state;
  }
}

/** How many recent turns the voice model is told about when a call starts. */
const RECENT_TURNS = 6;
/** Longest line handed over per turn; the whole text has to fit one provider append of at most 500 tokens. */
const MAX_LINE_CHARS = 240;

/** The chat's recent messages as plain text, for the voice model when a call starts on them. */
export function renderRecentChatForVoice(items: ChatItem[]): string {
  const lines = items.flatMap((item) => {
    if (item.kind !== 'user' && item.kind !== 'answer') return [];
    const content = item.content.replace(/\s+/g, ' ').trim();
    if (!content) return [];
    const clipped = content.length > MAX_LINE_CHARS ? `${content.slice(0, MAX_LINE_CHARS)}…` : content;
    return [`${item.kind === 'user' ? 'User' : 'Assistant'}: ${clipped}`];
  });
  return lines.slice(-RECENT_TURNS).join('\n');
}

/** Set once, at the hook's first render, to offer voice. */
export type OaizChatVoiceOptions = {
  /** What the app is, for the voice model; at most 2,000 characters. */
  instructions?: string;
  /**
   * The native tools a spoken turn may call. The chat's tools do not carry over: the microphone
   * hears the room, and a named write tool runs at once on what it heard. Name read tools. A
   * message typed during a call uses the chat's tools.
   */
  nativeTools?: OaizChatMessage['nativeTools'];
  /** The integration actions a spoken turn may call, named on the same terms as `nativeTools`. */
  integrationTools?: OaizChatMessage['integrationTools'];
};

export type OaizChatVoiceControls = Pick<
  OaizVoiceSnapshot,
  'state' | 'assistantSpeech' | 'outputAnalyser' | 'muted' | 'error'
> & {
  /** Opens the call on this chat. A refusal arrives as `error`. */
  start: () => Promise<void>;
  /** Ends the call. A turn in progress finishes into the chat. */
  stop: () => void;
  toggleMute: () => void;
};

const NO_VOICE: OaizVoiceSnapshot = {
  state: 'idle',
  assistantSpeech: '',
  outputAnalyser: null,
  muted: false,
  error: null,
  sessionId: null,
  turnRunning: false,
};
const noVoice = () => NO_VOICE;
const subscribeToNothing = () => () => undefined;

export type UseOaizChatOptions = Pick<
  OaizChatMessage,
  'systemPrompt' | 'nativeTools' | 'integrationTools' | 'model' | 'providerKeyUuid'
> & {
  /** `client.chat` of the app's `@oaiz/sdk` client, created once at module scope. */
  chat: Pick<OaizChat, 'send' | 'approve' | 'decline' | 'sessions' | 'voice'>;
  /** A saved chat to open first; omit it to start a new one. */
  sessionId?: string;
  /** Offers voice, with the tools a spoken turn may call. */
  voice?: OaizChatVoiceOptions;
};

export type OaizChatControls = OaizChatState & {
  /** Sends one member message. It does nothing while a turn runs or a call waits for a decision. */
  send: (content: string) => Promise<void>;
  /** Runs the pending call with its saved arguments and streams the rest of the turn. */
  approve: () => Promise<void>;
  /** Tells the agent the member declined: the pending call does not run, and the turn goes on. */
  decline: () => Promise<void>;
  /** Closes the stream, which stops the turn. What the turn saved stays in the chat. */
  stop: () => void;
  /**
   * Sends the failed message again, or loads the chat again when loading it or a decision failed.
   */
  retry: () => Promise<void>;
  /** Opens a saved chat, such as one from `chat.sessions.list()`. */
  openSession: (sessionId: string) => Promise<void>;
  /** Starts an empty chat. */
  newChat: () => void;
  /** The voice call on this chat; null unless the `voice` option is set. */
  voice: OaizChatVoiceControls | null;
};

/** One chat with the app's agent over `client.chat`, as rows the chat panel displays. */
export function useOaizChat({
  chat,
  sessionId: initialSession,
  voice: voiceOptions,
  ...turn
}: UseOaizChatOptions): OaizChatControls {
  const [state, setState] = useState<OaizChatState>({
    ...NEW_CHAT,
    sessionId: initialSession ?? null,
    loading: initialSession !== undefined,
  });
  const running = useRef<AbortController | null>(null);
  const latestOpen = useRef(0);
  // A failed decision is not sent again: OAIZ may have taken it, so retry reloads the chat.
  const lastWasDecision = useRef(false);

  // The chat's own tools stay out of a spoken turn: only the voice option names them. A message
  // typed during a call is the member's own, so it keeps the chat's tools.
  const voiceTurns = useRef<Record<OaizVoiceTurnSource, OaizVoiceTurn>>({
    spoken: { systemPrompt: turn.systemPrompt },
    typed: turn,
  });
  useEffect(() => {
    voiceTurns.current = {
      spoken: {
        systemPrompt: turn.systemPrompt,
        model: turn.model,
        providerKeyUuid: turn.providerKeyUuid,
        nativeTools: voiceOptions?.nativeTools,
        integrationTools: voiceOptions?.integrationTools,
      },
      typed: turn,
    };
  });
  const [voiceClient] = useState(() =>
    voiceOptions === undefined
      ? null
      : chat.voice({
          instructions: voiceOptions.instructions,
          turn: (source) => voiceTurns.current[source],
          onEvent: (event) => setState((current) => applyChatEvent(current, event)),
        }),
  );
  const voice = useSyncExternalStore(
    voiceClient?.subscribe ?? subscribeToNothing,
    voiceClient?.getSnapshot ?? noVoice,
  );

  // A voice turn has no `run` around it, so its start and end come from the voice client.
  const voiceTurnRan = useRef(false);
  useEffect(() => {
    if (voice.turnRunning === voiceTurnRan.current) return;
    voiceTurnRan.current = voice.turnRunning;
    if (voice.turnRunning) {
      setState((current) => ({ ...current, error: null, status: 'waiting' }));
    } else if (running.current === null) {
      setState((current) => ({ ...current, status: 'idle', items: settled(current.items, current.pending !== null) }));
    }
  }, [voice.turnRunning]);

  /** Ends the call and its turns, because the chat they belong to is leaving the view. */
  function leaveVoice() {
    voiceClient?.stopAllTurns();
    void voiceClient?.stop();
  }

  /** Leaves the running turn behind, so that it changes nothing more in the chat. */
  function abandonTurn() {
    running.current?.abort();
    running.current = null;
    leaveVoice();
  }

  async function openSession(sessionId: string) {
    abandonTurn();
    const open = ++latestOpen.current;
    setState({ ...NEW_CHAT, sessionId, loading: true });
    const answer = await chat.sessions.get(sessionId);
    if (open !== latestOpen.current) return;
    if (answer.error) {
      setState({ ...NEW_CHAT, sessionId, error: answer.error });
      return;
    }
    const items = (answer.data.messages ?? []).flatMap((message) => toItem(message) ?? []);
    const pending = answer.data.pendingApproval ? toPendingToolCall(answer.data.pendingApproval) : null;
    setState({ ...NEW_CHAT, sessionId, items: settled(items, pending !== null), pending });
  }

  useEffect(() => {
    if (initialSession !== undefined) void openSession(initialSession);
    // Later changes go through `openSession`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      running.current?.abort();
      leaveVoice();
    },
    // `voiceClient` is set once; `running` is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function run(content: string, base: ChatItem[]) {
    if (running.current !== null || state.pending !== null) return;
    const controller = new AbortController();
    running.current = controller;
    lastWasDecision.current = false;
    // Each attempt has its own id, because OAIZ runs a client message id once.
    const clientMessageId = crypto.randomUUID();
    setState((current) => ({
      ...current,
      error: null,
      status: 'waiting',
      items: [
        ...base,
        { kind: 'user', id: clientMessageId, content, createdAt: new Date().toISOString() },
      ],
    }));
    await follow(
      chat.send(
        { ...turn, content, clientMessageId, sessionId: state.sessionId ?? undefined },
        { signal: controller.signal },
      ),
      controller,
    );
  }

  /**
   * Continues the turn that waits on the pending call, with the chat's tools as the message had them.
   * The call stays pending until the continued turn starts, so a refused decision can be made again.
   */
  async function decide(approved: boolean) {
    const { pending, sessionId } = state;
    if (running.current !== null || pending === null || sessionId === null) return;
    const controller = new AbortController();
    running.current = controller;
    lastWasDecision.current = true;
    setState((current) => ({ ...current, error: null, status: 'waiting' }));
    const decision = { ...turn, sessionId, toolCallId: pending.toolCallId };
    const options = { signal: controller.signal };
    await follow(approved ? chat.approve(decision, options) : chat.decline(decision, options), controller);
  }

  /** Applies a turn's events to the chat until its stream ends. */
  async function follow(frames: ReturnType<OaizChat['send']>, controller: AbortController) {
    for await (const frame of frames) {
      // Closing the stream answers with a failure that the member asked for.
      if (controller.signal.aborted) break;
      const { data: event, error } = frame;
      setState((current) =>
        error ? { ...current, error } : applyChatEvent(current, event),
      );
    }
    if (running.current !== controller) return;
    running.current = null;
    setState((current) => ({
      ...current,
      status: 'idle',
      items: settled(current.items, current.pending !== null),
    }));
  }

  return {
    ...state,
    send: async (content) => {
      if (state.pending !== null) return;
      // A message typed during a call is answered in speech too.
      if (voiceClient?.getSnapshot().state === 'live') voiceClient.send(content);
      else await run(content, state.items);
    },
    approve: () => decide(true),
    decline: () => decide(false),
    stop: () => {
      running.current?.abort();
      voiceClient?.stopTurn();
    },
    retry: async () => {
      if (lastWasDecision.current && state.sessionId) {
        await openSession(state.sessionId);
        return;
      }
      const users = state.items.filter((item) => item.kind === 'user');
      const failed = users[users.length - 1];
      if (failed) await run(failed.content, state.items.slice(0, state.items.indexOf(failed)));
      else if (state.sessionId) await openSession(state.sessionId);
    },
    openSession,
    newChat: () => {
      abandonTurn();
      latestOpen.current += 1;
      setState(NEW_CHAT);
    },
    voice: voiceClient && {
      state: voice.state,
      assistantSpeech: voice.assistantSpeech,
      outputAnalyser: voice.outputAnalyser,
      muted: voice.muted,
      error: voice.error,
      start: async () => {
        const answer = await voiceClient.start({
          sessionId: state.sessionId ?? undefined,
          recentContext: renderRecentChatForVoice(state.items),
        });
        const sessionId = answer.data?.sessionId;
        // A stopped start can answer during a later call, so only the running call names the chat.
        if (sessionId && voiceClient.getSnapshot().sessionId === sessionId) {
          setState((current) => ({ ...current, sessionId }));
        }
      },
      stop: () => void voiceClient.stop(),
      toggleMute: voiceClient.toggleMute,
    },
  };
}
