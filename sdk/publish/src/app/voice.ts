import type { Client } from "../client";
import type {
  DtoAppChatMessageRequest,
  DtoChatTimelineEvent,
  DtoChatTimelineMessage,
  DtoVoiceDelegationResultPayload,
} from "../models";
import type { OaizChatMessage } from "./chat";
import { sendRaw } from "./raw-request";
import { failure, failureFrom, type OaizError, type OaizResponse } from "./response";
import { readSseStream, type OpenStream } from "./sse-stream";

/** The data channel name the provider opens its JSON event stream on. */
const LIVE_VOICE_EVENT_CHANNEL = "oai-events";

/**
 * How long to wait for ICE gathering before sending the offer. The provider exchanges a complete
 * offer for a complete answer rather than trickling, so the offer has to carry its candidates.
 */
const ICE_GATHERING_TIMEOUT_MS = 3_000;

/**
 * How long to wait for `session.closed` after asking to close. Per the provider contract a socket
 * close alone does not finalize a session, so stopping asks first and only then closes the connection.
 */
const SESSION_CLOSE_TIMEOUT_MS = 2_000;

/** How long a release or a turn waits for the spoken lines on their way to OAIZ. */
const LINES_TIMEOUT_MS = 2_000;

/** How long a sign-out waits for the call's release before it forgets the session. */
const SIGN_OUT_RELEASE_TIMEOUT_MS = 5_000;

/** Fewer words than this from the voice model is a backchannel, not a turn. */
const SUBSTANTIAL_ASSISTANT_WORDS = 4;

/** What the voice model says for a turn the member stopped, which sends no result. */
const STOPPED_SPEECH = "Okay, I stopped that.";
/** What the voice model says for a turn that ended with no result. */
const FAILED_SPEECH = "That didn't work. There's an error on screen.";

const VOICE_UNAVAILABLE: OaizError = {
  message: "Voice needs a secure browser page with WebRTC and a microphone.",
  code: "voice-browser-required",
  hints: [],
};
const VOICE_ALREADY_STARTED: OaizError = {
  message: "This voice conversation is already running.",
  code: "voice-already-started",
  hints: [],
};
const VOICE_NOT_LIVE: OaizError = {
  message: "No voice conversation is live.",
  code: "voice-not-live",
  hints: [],
};
const VOICE_TURN_ENDED: OaizError = {
  message: "The answer stopped before it finished.",
  code: "voice-turn-ended",
  hints: [],
};
const NO_WEBRTC_OFFER: OaizError = {
  message: "The browser produced no WebRTC offer.",
  code: "voice-no-webrtc-offer",
  hints: [],
};
const MICROPHONE_IN_FRAME: OaizError = {
  message: "The browser refuses the microphone to an app inside a frame. Open the app in its own tab to talk to it.",
  code: "voice-microphone-in-frame",
  hints: [],
};
const MICROPHONE_BLOCKED: OaizError = {
  message: "Microphone access is blocked. Enable the mic permission for this site in your browser settings, then try again.",
  code: "voice-microphone-blocked",
  hints: [],
};
const MICROPHONE_NOT_FOUND: OaizError = {
  message: "No microphone was found. Connect a microphone and try again.",
  code: "voice-microphone-not-found",
  hints: [],
};
const MICROPHONE_IN_USE: OaizError = {
  message: "Your microphone is in use by another application. Close it and try again.",
  code: "voice-microphone-in-use",
  hints: [],
};
const MICROPHONE_UNSUPPORTED: OaizError = {
  message: "Your microphone does not support the required audio settings.",
  code: "voice-microphone-unsupported",
  hints: [],
};
const MICROPHONE_INTERRUPTED: OaizError = {
  message: "Microphone access was interrupted. Please try again.",
  code: "voice-microphone-interrupted",
  hints: [],
};
const MICROPHONE_FAILED: OaizError = {
  message: "Could not start the microphone.",
  code: "voice-microphone-failed",
  hints: [],
};

/** What a voice turn runs with; the turn gets no other tools. */
export type OaizVoiceTurn = Pick<
  OaizChatMessage,
  "systemPrompt" | "nativeTools" | "integrationTools" | "model" | "providerKeyUuid"
>;

/** Where a voice turn's request came from: the microphone, or the member's keyboard during the call. */
export type OaizVoiceTurnSource = "spoken" | "typed";

/** How a voice conversation runs its turns. */
export interface OaizVoiceOptions {
  /**
   * Read for each turn, so tools stay per message. The voice model hears the room and a named
   * write tool runs at once on what it heard, so name only what a spoken request may run. A typed
   * request comes from the member's keyboard, so it can name the chat's tools.
   */
  turn: (source: OaizVoiceTurnSource) => OaizVoiceTurn;
  /** What the app is, at most 2,000 characters. It adds to OAIZ's voice prompt and replaces nothing in it. */
  instructions?: string;
  /** Receives the member's message and every chat event of each voice turn. */
  onEvent?: (event: DtoChatTimelineEvent) => void;
}

/** Where a voice conversation starts. */
export interface OaizVoiceStart {
  /** The chat to continue; omit it to start one. */
  sessionId?: string;
  /** The recent chat, told to the voice model once the call is up. */
  recentContext?: string;
}

/** The chat a started conversation joined. */
export interface OaizVoiceStarted {
  /** Null when `stop` ended the conversation before OAIZ named a new chat. */
  sessionId: string | null;
}

export type OaizVoiceState = "idle" | "connecting" | "live" | "closing";

export interface OaizVoiceSnapshot {
  state: OaizVoiceState;
  /** What the voice model is saying right now. The member's speech is not written here. */
  assistantSpeech: string;
  /**
   * Analyser on the remote playback stream. An orb reads its loudness from this, not from the
   * transcript, because transcript deltas arrive before the audio does.
   */
  outputAnalyser: AnalyserNode | null;
  muted: boolean;
  /** Why the conversation did not start, why it ended, or why its last turn failed. */
  error: OaizError | null;
  /** The chat this conversation joined, while it runs. */
  sessionId: string | null;
  /** A voice turn runs or waits. A turn can outlive the call that started it. */
  turnRunning: boolean;
}

/** What a voice conversation needs from the member's session with the app. */
export interface OaizVoiceAuth {
  /** The access token, renewed first when it expires soon. */
  accessToken(): Promise<string | undefined>;
  /** The stored access token, read with no network call. */
  storedAccessToken(): string | undefined;
  /** Runs `hook` before a sign-out forgets the session, and answers the function that removes it. */
  beforeSignOut(hook: () => Promise<void>): () => void;
}

interface ProviderEvent {
  type?: string;
  delta?: string;
  /** Present on session.delegation.created. The id lives on the nested delegation object. */
  delegation?: { id?: string };
}

/** One turn the conversation waits on. `delegationId` is null for a turn the member typed. */
interface VoiceTurnRequest {
  content: string;
  delegationId: string | null;
  sessionId: string;
  clientMessageId: string;
  /** Closing the stream stops the turn. */
  controller: AbortController;
  /** The last progress line handed over, so parallel copies of one step are not each spoken. */
  lastProgress: string;
  /** The channel of the call that asked for this turn. A turn can outlive that call, and a later call does not hear it. */
  channel: RTCDataChannel | null;
}

const IDLE_SNAPSHOT: OaizVoiceSnapshot = {
  state: "idle",
  assistantSpeech: "",
  outputAnalyser: null,
  muted: false,
  error: null,
  sessionId: null,
  turnRunning: false,
};

/**
 * One voice conversation with the app's agent as the signed-in member. The browser holds the
 * microphone and the WebRTC connection to the voice model; OAIZ opens and ends the call and runs
 * each delegation as a chat turn. No method throws. Create it with `client.chat.voice`.
 */
export class OaizVoice {
  private snapshot: OaizVoiceSnapshot = IDLE_SNAPSHOT;
  private readonly listeners = new Set<() => void>();

  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private outputSource: MediaStreamAudioSourceNode | null = null;
  private liveSessionId: string | null = null;
  /** The chat the call is billed against and whose history the spoken lines join. */
  private chatSessionId: string | null = null;
  private closedResolve: (() => void) | null = null;
  private removeSignOutHook: (() => void) | null = null;
  /** Set when the call ends while `connect` is in flight, so `connect` releases what it allocated. */
  private startAborted = false;
  private starting: Promise<unknown> = Promise.resolve();
  private stopping: Promise<void> = Promise.resolve();
  private eventSeq = 0;
  /** The member's words since the voice model's last real reply. The delegation event carries no task text. */
  private pendingUserSpeech = "";
  /** What the voice model has said since the member's last word. */
  private pendingAssistantSpeech = "";
  /** The recent chat, told to the voice model once the call is up. */
  private seedContext = "";
  /** Each turn is one POST and OAIZ runs parallel POSTs in parallel, so turns wait here in order. */
  private turns: VoiceTurnRequest[] = [];
  private runningTurn: VoiceTurnRequest | null = null;
  /** The spoken lines on their way to OAIZ, one at a time, in spoken order. */
  private lines: Promise<void> = Promise.resolve();

  /** @internal */
  constructor(
    private readonly client: Client,
    private readonly open: OpenStream,
    private readonly app: string,
    private readonly auth: OaizVoiceAuth,
    private readonly url: string,
    private readonly options: OaizVoiceOptions,
  ) {}

  /** Calls `listener` on each change of the snapshot, and answers the function that removes it. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The conversation now. It is the same object until something changes. */
  getSnapshot = (): OaizVoiceSnapshot => this.snapshot;

  /**
   * Opens the call: asks for the microphone, then connects through OAIZ. A refusal answers one
   * failure with its `error.code` and leaves the conversation idle; `stop` while this runs releases what
   * it allocated and answers with no error.
   */
  start(options: OaizVoiceStart = {}): Promise<OaizResponse<OaizVoiceStarted>> {
    if (voiceUnavailable()) return Promise.resolve(this.refuse(VOICE_UNAVAILABLE));
    if (this.snapshot.state !== "idle") return Promise.resolve(failure(0, VOICE_ALREADY_STARTED));
    const starting = this.connect(options);
    this.starting = starting;
    return starting;
  }

  /**
   * Sends a message the member typed during the call. It runs after any turn in progress, and its
   * answer is also spoken. The chat events arrive at `onEvent`.
   */
  send(content: string): { error: OaizError | null } {
    if (this.snapshot.state !== "live" || this.chatSessionId === null) return { error: VOICE_NOT_LIVE };
    this.flushPendingLines();
    this.appendThinking(null, `The user typed this in the chat window: ${content}`);
    this.enqueueTurn(content, null, this.chatSessionId);
    return { error: null };
  }

  /** Closes the running turn's stream, which stops the turn. The next turn in line then runs. */
  stopTurn = (): void => {
    this.runningTurn?.controller.abort();
  };

  /** Closes the running turn's stream and drops the turns waiting behind it. */
  stopAllTurns = (): void => {
    this.turns = [];
    this.runningTurn?.controller.abort();
  };

  toggleMute = (): void => {
    const next = !this.snapshot.muted;
    this.applyMute(next);
    this.publish({ muted: next });
  };

  /**
   * Ends the call and settles when OAIZ has released it. Turns in progress keep running into the
   * chat, and their events keep arriving at `onEvent`.
   */
  stop = (): Promise<void> => {
    const { state } = this.snapshot;
    if (state === "idle") return Promise.resolve();
    if (state === "closing") return this.stopping;
    this.publish({ state: "closing" });
    if (state === "connecting") {
      this.startAborted = true;
      this.stopping = this.starting.then(() => undefined);
      return this.stopping;
    }
    this.flushPendingLines();
    this.stopping = this.closeProviderSession();
    return this.stopping;
  };

  private async connect({ sessionId, recentContext = "" }: OaizVoiceStart): Promise<OaizResponse<OaizVoiceStarted>> {
    this.startAborted = false;
    this.chatSessionId = sessionId ?? null;
    const recent = recentContext.trim();
    this.seedContext = recent ? `Recent chat before this voice session:\n${recent}` : "";
    this.publish({ state: "connecting", error: null, assistantSpeech: "", muted: false, sessionId: this.chatSessionId });

    // A signed-out member must not keep a call open.
    this.removeSignOutHook = this.auth.beforeSignOut(this.releaseForSignOut);
    window.addEventListener("pagehide", this.leavePage);

    let localStream: MediaStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      this.teardown();
      return this.startAborted ? started(sessionId ?? null) : this.refuse(microphoneError(cause));
    }
    if (this.startAborted) {
      stopTracks(localStream);
      this.teardown();
      return started(sessionId ?? null);
    }
    this.stream = localStream;
    // A mute clicked during the permission prompt is kept.
    this.applyMute(this.snapshot.muted);

    let answeredSession = sessionId ?? null;
    try {
      const connection = this.openPeerConnection(localStream);
      await connection.setLocalDescription(await connection.createOffer());
      await waitForIceGathering(connection);
      if (this.startAborted) {
        this.teardown();
        return started(answeredSession);
      }

      const offerSdp = connection.localDescription?.sdp;
      if (!offerSdp) {
        await this.release();
        return this.refuse(NO_WEBRTC_OFFER);
      }

      const session = await this.client.createAppLiveVoiceSession(this.app, {
        sessionId,
        offerSdp,
        instructions: this.options.instructions,
      });
      this.liveSessionId = session.liveSessionId;
      this.chatSessionId = session.sessionId;
      answeredSession = session.sessionId;
      if (this.startAborted) {
        await this.release();
        return started(answeredSession);
      }
      this.publish({ sessionId: session.sessionId });

      await connection.setRemoteDescription({ type: "answer", sdp: session.answerSdp });
      if (this.startAborted) {
        await this.release();
        return started(answeredSession);
      }
      this.publish({ state: "live" });
      return { data: { sessionId: session.sessionId }, error: null, count: null, status: 201 };
    } catch (cause) {
      const aborted = this.startAborted;
      await this.release();
      if (aborted) return started(answeredSession);
      const refusal = failureFrom(cause);
      this.publish({ error: refusal.error });
      return refusal;
    }
  }

  private openPeerConnection(localStream: MediaStream): RTCPeerConnection {
    const connection = new RTCPeerConnection();
    this.peer = connection;

    for (const track of localStream.getAudioTracks()) {
      connection.addTrack(track, localStream);
    }

    const element = document.createElement("audio");
    element.autoplay = true;
    this.audio = element;
    connection.ontrack = (ev) => {
      const remote = ev.streams[0] ?? null;
      // Chrome only feeds Web Audio from a remote stream that a media element is also playing,
      // so the element is attached first.
      element.srcObject = remote;
      this.publish({ outputAnalyser: remote ? this.attachOutputAnalyser(remote) : null });
    };

    // The provider reports a normal end in-band on the data channel, but a dropped network or a
    // sleeping laptop kills that channel silently. Only the connection this closure owns acts, so
    // a stale callback from a previous call cannot end the current one.
    connection.onconnectionstatechange = () => {
      if (this.peer !== connection) return;
      const state = connection.connectionState;
      if (state === "failed" || state === "disconnected" || state === "closed") {
        void this.release();
      }
    };

    const dataChannel = connection.createDataChannel(LIVE_VOICE_EVENT_CHANNEL);
    this.channel = dataChannel;
    dataChannel.onmessage = (ev: MessageEvent<string>) => {
      if (this.channel !== dataChannel) return;
      // Renews only near expiry, so a quiet call still holds a token its release can send.
      void this.auth.accessToken();
      try {
        this.handleProviderEvent(JSON.parse(ev.data) as ProviderEvent);
      } catch {
        // The event's text may be speech, so it stays out of the console.
        console.error("unparsable live voice event");
      }
    };
    return connection;
  }

  private handleProviderEvent(event: ProviderEvent): void {
    switch (event.type) {
      case "session.started":
        if (this.snapshot.state === "connecting") this.publish({ state: "live" });
        if (this.seedContext) {
          this.appendThinking(null, this.seedContext);
          this.seedContext = "";
        }
        break;
      case "session.input_transcript.delta":
        if (this.pendingAssistantSpeech) this.closeAssistantLine();
        this.pendingUserSpeech += event.delta ?? "";
        this.publish({ assistantSpeech: "" });
        break;
      case "session.output_transcript.delta":
        if (event.delta) {
          this.pendingAssistantSpeech += event.delta;
          this.publish({ assistantSpeech: this.snapshot.assistantSpeech + event.delta });
        }
        break;
      case "session.delegation.created":
        if (event.delegation?.id) this.dispatchDelegation(event.delegation.id);
        break;
      case "session.closed":
        this.flushPendingLines();
        if (this.closedResolve) {
          this.closedResolve();
          this.closedResolve = null;
          break;
        }
        // The provider ended the session on its own, so nothing else releases it.
        void this.release();
        break;
    }
  }

  /**
   * A delegation turns the member's words since the last real reply into the chat turn, verbatim.
   * Nothing else travels in the message: the spoken lines before it are already history. A holding
   * phrase spoken before the delegation stays pending and is recorded at the next boundary.
   */
  private dispatchDelegation(delegationId: string): void {
    const request = this.pendingUserSpeech.trim();
    this.pendingUserSpeech = "";
    // The member has hung up, so what the microphone still heard runs nothing.
    if (!request || this.chatSessionId === null || this.snapshot.state !== "live") return;
    this.enqueueTurn(request, delegationId, this.chatSessionId);
  }

  private enqueueTurn(content: string, delegationId: string | null, sessionId: string): void {
    const clientMessageId = crypto.randomUUID();
    // A turn's stream carries only what the agent adds, so the member's message is reported here.
    this.options.onEvent?.({
      type: "message.created",
      message: {
        id: clientMessageId,
        clientMessageId,
        role: "user",
        messageType: "user_input",
        content,
        createdAt: new Date().toISOString(),
      },
    });
    this.turns.push({
      content,
      delegationId,
      sessionId,
      clientMessageId,
      controller: new AbortController(),
      lastProgress: "",
      channel: this.channel,
    });
    void this.runTurns();
  }

  private async runTurns(): Promise<void> {
    if (this.runningTurn !== null) return;
    for (let turn = this.turns.shift(); turn !== undefined; turn = this.turns.shift()) {
      this.runningTurn = turn;
      this.publish({ turnRunning: true });
      await this.runTurn(turn);
      this.runningTurn = null;
    }
    this.publish({ turnRunning: false });
  }

  private async runTurn(turn: VoiceTurnRequest): Promise<void> {
    let result = false;
    let refusal: OaizResponse<never> | undefined;
    try {
      // The lines spoken before this request come first in the chat's history.
      await within(this.lines, LINES_TIMEOUT_MS);
      this.publish({ error: null });
      const body: DtoAppChatMessageRequest = {
        ...this.options.turn(turn.delegationId === null ? "typed" : "spoken"),
        content: turn.content,
        sessionId: turn.sessionId,
        clientMessageId: turn.clientMessageId,
        type: "voice_delegation",
        voiceDelegationId: turn.delegationId ?? undefined,
      };
      const frames = readSseStream<DtoChatTimelineEvent>(
        this.open,
        { operation: "createAppChatMessage", params: { appUuid: this.app } },
        body,
        turn.controller.signal,
        "chat_event",
        // `voice.delegationResult` follows `generation.finished`.
        (event) => event.type === "voice.delegationResult",
      );
      for await (const frame of frames) {
        // Closing the stream answers with a failure the member asked for.
        if (turn.controller.signal.aborted) break;
        if (frame.error !== null) {
          refusal = frame;
          break;
        }
        const event = frame.data.data;
        this.options.onEvent?.(event);
        this.noteToolStep(turn, event);
        if (event.voiceDelegationResult) {
          result = true;
          this.speakResult(turn, event.voiceDelegationResult);
        }
      }
    } catch (cause) {
      refusal = failureFrom(cause);
    }
    if (!result) this.finishWithoutResult(turn, refusal);
  }

  /** The voice model waits for a result, so a turn that sends none still answers it. */
  private finishWithoutResult(turn: VoiceTurnRequest, refusal: OaizResponse<never> | undefined): void {
    if (turn.controller.signal.aborted) {
      this.appendCommentary(turn.delegationId, STOPPED_SPEECH, turn.channel);
      return;
    }
    // OAIZ refused the typed message, so no answer is coming for it.
    if (turn.delegationId === null && refusal !== undefined && refusal.status >= 400) {
      this.appendThinking(null, "The typed message was not sent. No answer is coming for it.", turn.channel);
    }
    this.appendCommentary(turn.delegationId, FAILED_SPEECH, turn.channel);
    this.publish({ error: refusal?.error ?? VOICE_TURN_ENDED });
    if (refusal?.status === 401) this.endForRefusedToken();
  }

  /** Hands a tool step to the voice model as silent context while its turn runs. */
  private noteToolStep(turn: VoiceTurnRequest, event: DtoChatTimelineEvent): void {
    if (event.type !== "message.created" && event.type !== "message.updated") return;
    const content = toolProgress(event.message);
    if (content === null || content === turn.lastProgress) return;
    turn.lastProgress = content;
    this.appendThinking(turn.delegationId, content, turn.channel);
  }

  /** The plain written answer goes first, so the voice model holds it for follow-up questions by the time it speaks. */
  private speakResult(turn: VoiceTurnRequest, result: DtoVoiceDelegationResultPayload): void {
    // An empty id is a typed turn: its speech addresses the whole session.
    const delegationId = result.delegationId || null;
    if (result.context) this.appendThinking(delegationId, `Written answer shown on screen:\n${result.context}`, turn.channel);
    if (result.speech) this.appendCommentary(delegationId, result.speech, turn.channel);
  }

  /**
   * The assistant finished a line and the member is speaking again. The line is recorded whatever
   * its length. A real reply also closes the member's utterance and records it; a backchannel leaves
   * the member's words growing, so the next request is not cut into fragments.
   */
  private closeAssistantLine(): void {
    const assistantLine = this.pendingAssistantSpeech;
    this.pendingAssistantSpeech = "";
    if (isSubstantialAssistantLine(assistantLine)) {
      this.recordLine("user", this.pendingUserSpeech);
      this.pendingUserSpeech = "";
    }
    this.recordLine("assistant", assistantLine);
  }

  /** Records whatever is still pending, in spoken order. */
  private flushPendingLines(): void {
    this.recordLine("user", this.pendingUserSpeech);
    this.recordLine("assistant", this.pendingAssistantSpeech);
    this.pendingUserSpeech = "";
    this.pendingAssistantSpeech = "";
  }

  /**
   * Records one spoken line as history for the chat's later turns. Each line waits for the one
   * before it, so a slow request does not reorder them.
   */
  private recordLine(speaker: "user" | "assistant", text: string): void {
    const content = text.trim();
    const sessionId = this.chatSessionId;
    if (!content || sessionId === null) return;
    this.lines = this.lines.then(() => this.postLine(sessionId, speaker, content));
  }

  private async postLine(sessionId: string, speaker: "user" | "assistant", content: string): Promise<void> {
    try {
      await this.client.createAppVoiceLine(this.app, sessionId, { speaker, content });
    } catch (cause) {
      const { status, error } = failureFrom(cause);
      console.warn("spoken line not recorded", { status, code: error?.code });
      if (status === 401) {
        this.publish({ error });
        this.endForRefusedToken();
      }
    }
  }

  /** The SDK renews its token before each call, so a 401 means the session is revoked. */
  private endForRefusedToken(): void {
    this.turns = [];
    void this.stop();
  }

  private async closeProviderSession(): Promise<void> {
    const connection = this.peer;
    const closed = new Promise<void>((resolve) => {
      this.closedResolve = resolve;
    });
    if (this.appendEvent({ type: "session.close", event_id: this.nextEventId() })) {
      await within(closed, SESSION_CLOSE_TIMEOUT_MS);
    }
    if (this.peer === connection) await this.release();
  }

  /**
   * Releases the provider session and every local resource. The spoken lines go first, because
   * OAIZ refuses a line after the release.
   */
  private async release(): Promise<void> {
    this.flushPendingLines();
    const liveSessionId = this.liveSessionId;
    const lines = this.lines;
    this.liveSessionId = null;
    this.teardown();
    if (liveSessionId === null) return;
    await within(lines, LINES_TIMEOUT_MS);
    try {
      await this.client.deleteAppLiveVoiceSession(this.app, liveSessionId);
    } catch (cause) {
      const { status, error } = failureFrom(cause);
      console.warn("live voice session not released", { status, code: error?.code });
    }
  }

  private readonly releaseForSignOut = async (): Promise<void> => {
    this.stopAllTurns();
    await within(this.stop(), SIGN_OUT_RELEASE_TIMEOUT_MS);
  };

  /**
   * The page may never run again, also when the browser keeps it in its cache. This ends the turns,
   * as a closed page does, and sends the release first, because renewal is a network call that page
   * leave can end. Lines still pending are dropped.
   */
  private readonly leavePage = (): void => {
    this.stopAllTurns();
    const liveSessionId = this.liveSessionId;
    this.liveSessionId = null;
    if (liveSessionId !== null) this.releaseOnLeave(liveSessionId);
    if (this.snapshot.state === "connecting" || this.startAborted) {
      this.startAborted = true;
      this.publish({ state: "closing" });
      this.closeMedia();
      return;
    }
    this.teardown();
  };

  /** A raw request, because the generated client has no keepalive option. */
  private releaseOnLeave(liveSessionId: string): void {
    const token = this.auth.storedAccessToken();
    void sendRaw(
      this.url,
      { operation: "deleteAppLiveVoiceSession", params: { appUuid: this.app, id: liveSessionId } },
      { headers: token === undefined ? {} : { Authorization: `Bearer ${token}` }, keepalive: true },
    ).catch(() => undefined);
  }

  private closeMedia(): void {
    this.channel?.close();
    this.channel = null;

    this.peer?.close();
    this.peer = null;

    if (this.stream !== null) stopTracks(this.stream);
    this.stream = null;

    if (this.audio !== null) {
      this.audio.srcObject = null;
      this.audio.remove();
      this.audio = null;
    }

    this.outputSource?.disconnect();
    this.outputSource = null;
    if (this.audioContext !== null) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }

  private teardown(): void {
    this.removeSignOutHook?.();
    this.removeSignOutHook = null;
    window.removeEventListener("pagehide", this.leavePage);

    this.closeMedia();

    this.closedResolve?.();
    this.closedResolve = null;
    this.chatSessionId = null;
    this.pendingUserSpeech = "";
    this.pendingAssistantSpeech = "";
    this.seedContext = "";
    this.publish({ ...IDLE_SNAPSHOT, error: this.snapshot.error, turnRunning: this.snapshot.turnRunning });
  }

  private publish(patch: Partial<OaizVoiceSnapshot>): void {
    const unchanged = Object.entries(patch).every(([key, value]) =>
      Object.is(Reflect.get(this.snapshot, key), value),
    );
    if (unchanged) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private refuse(error: OaizError): OaizResponse<never> {
    this.publish({ error });
    return failure(0, error);
  }

  private nextEventId(): string {
    this.eventSeq += 1;
    return `oaiz_${Date.now()}_${this.eventSeq}`;
  }

  private appendEvent(event: Record<string, unknown>, channel = this.channel): boolean {
    if (channel?.readyState !== "open") return false;
    channel.send(JSON.stringify(event));
    return true;
  }

  private appendThinking(delegationId: string | null, content: string, channel = this.channel): void {
    this.appendEvent({ type: "session.thinking.append", event_id: this.nextEventId(), delegation_id: delegationId, content }, channel);
  }

  private appendCommentary(delegationId: string | null, content: string, channel = this.channel): void {
    this.appendEvent({ type: "session.commentary.append", event_id: this.nextEventId(), delegation_id: delegationId, content }, channel);
  }

  private applyMute(muted: boolean): void {
    for (const track of this.stream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  /**
   * Taps the remote playback stream with an AnalyserNode. One AudioContext lives for the whole call,
   * so an orb can remount without opening a new context. Answers null where Web Audio is unavailable.
   */
  private attachOutputAnalyser(remote: MediaStream): AnalyserNode | null {
    const AudioContextCtor =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    const context = this.audioContext ?? new AudioContextCtor();
    this.audioContext = context;

    this.outputSource?.disconnect();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    this.outputSource = context.createMediaStreamSource(remote);
    this.outputSource.connect(analyser);
    void context.resume();
    return analyser;
  }
}

function started(sessionId: string | null): OaizResponse<OaizVoiceStarted> {
  return { data: { sessionId }, error: null, count: null, status: 200 };
}

function voiceUnavailable(): boolean {
  return (
    typeof window === "undefined" ||
    typeof RTCPeerConnection === "undefined" ||
    typeof navigator === "undefined" ||
    navigator.mediaDevices === undefined
  );
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Maps a getUserMedia failure to an actionable error. The browser names the cause on a DOMException;
 * its own message ("Permission denied") is not useful to a member. A frame gets the refusal with no
 * prompt, so inside one the refusal has one answer: the app's own tab.
 */
function microphoneError(cause: unknown): OaizError {
  const name = typeof cause === "object" && cause !== null ? Reflect.get(cause, "name") : undefined;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return window.self !== window.top ? MICROPHONE_IN_FRAME : MICROPHONE_BLOCKED;
    case "NotFoundError":
    case "DevicesNotFoundError":
      return MICROPHONE_NOT_FOUND;
    case "NotReadableError":
    case "TrackStartError":
      return MICROPHONE_IN_USE;
    case "OverconstrainedError":
      return MICROPHONE_UNSUPPORTED;
    case "AbortError":
      return MICROPHONE_INTERRUPTED;
    default:
      return MICROPHONE_FAILED;
  }
}

/**
 * Whether the voice model's line was a real reply. "Mm-h" or "Sure thing." while the member is still
 * talking must not end the member's utterance; a question or a full sentence does.
 */
function isSubstantialAssistantLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.includes("?")) return true;
  return trimmed.split(/\s+/).filter(Boolean).length >= SUBSTANTIAL_ASSISTANT_WORDS;
}

/**
 * The progress line of a tool step. Only starts and failures go over: a finish is implied by the
 * next start or by the answer, and every append tempts the voice to say something.
 */
function toolProgress(message: DtoChatTimelineMessage | null | undefined): string | null {
  const started = message?.messageType === "tool_started";
  if (!started && message?.messageType !== "tool_finished") return null;
  const call = message.artifacts?.find((artifact) => artifact.toolCallResult)?.toolCallResult;
  if (!call?.toolName || (!started && call.success)) return null;
  const label = call.displayName?.trim() || call.toolName.replace(/_/g, " ");
  return `Backend step ${started ? "started" : "failed"}: ${label}`;
}

/** Settles when `work` settles, or after `ms`. */
function within(work: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    work.then(finish, finish);
  });
}

/**
 * Settles once the peer connection has gathered its ICE candidates, or after a bound. The provider
 * answers a complete offer, so the candidates must be in the SDP before it is sent.
 */
function waitForIceGathering(connection: RTCPeerConnection): Promise<void> {
  if (connection.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      connection.removeEventListener("icegatheringstatechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (connection.iceGatheringState === "complete") finish();
    };
    const timer = setTimeout(finish, ICE_GATHERING_TIMEOUT_MS);
    connection.addEventListener("icegatheringstatechange", onStateChange);
  });
}
