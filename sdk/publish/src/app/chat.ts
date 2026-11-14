import type { Client, ListAppChatSessionsParams } from "../client";
import type {
  DtoAppChatApprovalRequest,
  DtoAppChatMessageRequest,
  DtoAppChatSessionDetail,
  DtoChatSessionListOutput,
  DtoAppChatIntegrationTool,
  DtoAppChatNativeTool,
  DtoChatTimelineEvent,
  DtoLLM,
  DtoToolMetadata,
  DtoWorkflowToolSummary,
} from "../models";
import type { RawRequest } from "./raw-request";
import { failureFrom, type OaizResponse } from "./response";
import { readSseStream, type OpenStream } from "./sse-stream";
import { OaizVoice, type OaizVoiceAuth, type OaizVoiceOptions } from "./voice";

/** One member message to the app's agent. */
export interface OaizChatMessage {
  /** The member's message. */
  content: string;
  /** The app's whole system prompt for this turn; OAIZ adds none and does not store it. */
  systemPrompt: string;
  /**
   * The built-in OAIZ tools this turn may call, each named once; it gets no others. A tool with
   * `requireApproval` does not run until the member approves the call: the turn ends with
   * `tool.approvalRequired`. Every other tool runs at once.
   */
  nativeTools?: DtoAppChatNativeTool[];
  /**
   * The actions on integrations shared with the app that this turn may call, each named once, with
   * `requireApproval` as for `nativeTools`; it gets no others.
   */
  integrationTools?: DtoAppChatIntegrationTool[];
  /** The chat to continue; omit it to start one. `session.created` carries a new chat's id. */
  sessionId?: string;
  /** Deduplicates a resent message within its chat; a new UUID when omitted. */
  clientMessageId?: string;
  /** The model the turn runs on; the organisation's default chat model when omitted. */
  model?: DtoLLM;
  /** The organisation's own provider key `model` runs on. */
  providerKeyUuid?: string;
}

/**
 * A decision on the tool call a paused turn waits on. It carries the same turn settings as the
 * message that started the turn; OAIZ stores none of them.
 */
export interface OaizChatDecision extends Omit<OaizChatMessage, "content" | "sessionId" | "clientMessageId"> {
  /** The chat whose turn waits on the call. */
  sessionId: string;
  /** The call to decide: `toolApprovalInfo.toolCallId` of `tool.approvalRequired`, or `pendingApproval.toolCallId` of `sessions.get`. */
  toolCallId: string;
}

/** Options of a chat message stream. */
export interface OaizChatSendOptions {
  /** Closes the stream, which stops the turn; the parts it already saved stay in the chat. */
  signal?: AbortSignal;
}

/** The tools a message may name in this app. */
export interface OaizChatTools {
  /** The built-in OAIZ tools this app's chat accepts, by `name`. */
  nativeTools: DtoToolMetadata[];
  /** The integration actions shared with the app, by `integrationUuid` and `actionType`. */
  integrationTools: DtoWorkflowToolSummary[];
}

/** Lists and reads the signed-in member's chats in this app. */
export class OaizChatSessions {
  /** @internal */
  constructor(
    private readonly client: Client,
    private readonly app: string,
  ) {}

  /** Lists one page of chats, newest first. Never throws. */
  async list(params?: ListAppChatSessionsParams): Promise<OaizResponse<DtoChatSessionListOutput>> {
    try {
      const data = await this.client.listAppChatSessions(this.app, params);
      return { data, error: null, count: null, status: 200 };
    } catch (error) {
      return failureFrom(error);
    }
  }

  /**
   * Reads one chat with its saved messages, and `pendingApproval` while a tool call of the chat
   * waits for a decision. Never throws.
   */
  async get(sessionId: string): Promise<OaizResponse<DtoAppChatSessionDetail>> {
    try {
      const data = await this.client.getAppChatSession(this.app, sessionId);
      return { data, error: null, count: null, status: 200 };
    } catch (error) {
      return failureFrom(error);
    }
  }
}

/** Chats with an OAIZ agent as the signed-in member of this app. */
export class OaizChat {
  /** The signed-in member's chats in this app. */
  readonly sessions: OaizChatSessions;

  /** @internal */
  constructor(
    private readonly client: Client,
    private readonly open: OpenStream,
    private readonly app: string,
    private readonly auth: OaizVoiceAuth,
    private readonly url: string,
  ) {
    this.sessions = new OaizChatSessions(client, app);
  }

  /**
   * Sends one message and yields the turn's chat events until `generation.finished`. A refused
   * message yields one failure with its `error.code`; a turn that fails after it started yields an
   * `error` event before `generation.finished`. Stopping early closes the stream and stops the turn.
   * When the turn reaches a tool with `requireApproval`, it ends with `tool.approvalRequired`, whose
   * `toolApprovalInfo.toolCallId` names the call, then `generation.finished`; `approve` or
   * `decline` continues it. A message to a chat whose call waits for a decision is refused with
   * 409 `app-chat-tool-approval-pending`.
   */
  send(message: OaizChatMessage, options?: OaizChatSendOptions): AsyncIterable<OaizResponse<DtoChatTimelineEvent>> {
    const body: DtoAppChatMessageRequest = { ...message, clientMessageId: message.clientMessageId ?? crypto.randomUUID() };
    return this.stream({ operation: "createAppChatMessage", params: { appUuid: this.app } }, body, options?.signal);
  }

  /**
   * Runs the tool call a paused turn waits on and yields the continued turn's chat events until
   * `generation.finished`, like `send`. The turn may pause again on another `requireApproval`
   * call. A call that is not waiting for a decision, including one already decided, yields one
   * failure with 409 `app-chat-tool-call-not-pending`; a decision that loses a race with another
   * yields an `error` event with that code before `generation.finished`.
   */
  approve(decision: OaizChatDecision, options?: OaizChatSendOptions): AsyncIterable<OaizResponse<DtoChatTimelineEvent>> {
    return this.decide(decision, true, options);
  }

  /**
   * Declines the tool call a paused turn waits on: the call does not run, the model is told the
   * member declined it, and the continued turn streams as in `approve`.
   */
  decline(decision: OaizChatDecision, options?: OaizChatSendOptions): AsyncIterable<OaizResponse<DtoChatTimelineEvent>> {
    return this.decide(decision, false, options);
  }

  /**
   * A voice conversation with the app's agent. Create one per chat view: `start` opens the call,
   * and each thing the member asks for runs as one chat turn with the tools of `turn`.
   */
  voice(options: OaizVoiceOptions): OaizVoice {
    return new OaizVoice(this.client, this.open, this.app, this.auth, this.url, options);
  }

  /** Lists the tools a message may name: the built-in OAIZ tools the app's chat may use and the integration actions shared with the app. Never throws. */
  async tools(): Promise<OaizResponse<OaizChatTools>> {
    try {
      const [natives, list] = await Promise.all([
        this.client.getNativeTools({ surface: "app" }),
        this.client.listTools(),
      ]);
      const integrationTools = list.items.filter((item) => item.kind === "integration");
      return { data: { nativeTools: natives.items, integrationTools }, error: null, count: null, status: 200 };
    } catch (error) {
      return failureFrom(error);
    }
  }

  private decide(
    decision: OaizChatDecision,
    approved: boolean,
    options: OaizChatSendOptions | undefined,
  ): AsyncIterable<OaizResponse<DtoChatTimelineEvent>> {
    const { sessionId, toolCallId, ...settings } = decision;
    const body: DtoAppChatApprovalRequest = { ...settings, approved };
    const raw: RawRequest = {
      operation: "createAppChatApproval",
      params: { appUuid: this.app, sessionId, toolCallId },
    };
    return this.stream(raw, body, options?.signal);
  }

  private async *stream(
    request: RawRequest,
    body: DtoAppChatMessageRequest | DtoAppChatApprovalRequest,
    signal: AbortSignal | undefined,
  ): AsyncGenerator<OaizResponse<DtoChatTimelineEvent>> {
    const frames = readSseStream<DtoChatTimelineEvent>(
      this.open,
      request,
      body,
      signal,
      "chat_event",
      (event) => event.type === "generation.finished",
    );
    for await (const frame of frames) {
      yield frame.error === null ? { ...frame, data: frame.data.data } : frame;
    }
  }
}
