import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { DtoAppChatNativeTool, DtoChatTimelineEvent } from "../../../models";
import { createClient, type OaizVoiceOptions, type OaizVoiceTurnSource } from "../../index";

const API_URL = "https://api.oaiz.test/";
const APP = "7e570000-0000-4000-8000-0000000000a1";
const SESSION = "7e570000-0000-4000-8000-0000000000b1";
const NEW_SESSION = "7e570000-0000-4000-8000-0000000000b2";
const LIVE_SESSION = "live-session-1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const SESSIONS_PATH = `/internalagents/chat/apps/${APP}/voice/sessions`;
const LIVE_SESSION_PATH = `${SESSIONS_PATH}/${LIVE_SESSION}`;
const MESSAGES_PATH = `/internalagents/chat/apps/${APP}/messages`;
const LINES_PATH = `/internalagents/chat/apps/${APP}/sessions/${SESSION}/voice-lines`;

const STOPPED_SPEECH = "Okay, I stopped that.";
const FAILED_SPEECH = "That didn't work. There's an error on screen.";

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  keepalive: boolean;
  signal: AbortSignal | null;
}

type Route = (call: Call) => Response | Promise<Response> | undefined;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function refusal(status: number, slug: string): Response {
  return json(status, { message: `refused: ${slug}`, slug });
}

/** A chat stream the test writes to frame by frame. It breaks when its request is aborted, as a real stream does. */
class TurnStream {
  private controller!: ReadableStreamDefaultController<Uint8Array>;
  private readonly encoder = new TextEncoder();
  readonly response: Response;

  constructor(signal: AbortSignal | null) {
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
      },
    });
    signal?.addEventListener("abort", () => this.controller.error(new DOMException("aborted", "AbortError")));
    this.response = new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  }

  push(event: Record<string, unknown>): void {
    this.controller.enqueue(this.encoder.encode(`event: chat_event\ndata: ${JSON.stringify(event)}\n\n`));
  }

  end(): void {
    this.controller.close();
  }

  /** Finishes the turn the way Core does for a voice turn: the result follows `generation.finished`. */
  finish(result: Record<string, unknown>): void {
    this.push({ type: "generation.finished" });
    this.push({ type: "voice.delegationResult", voiceDelegationResult: result });
    this.end();
  }
}

class FakeChannel {
  readyState = "open";
  sent: string[] = [];
  onmessage: ((ev: { data: string }) => void) | null = null;

  constructor(readonly label: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = "closed";
  }
}

let lastPeer: FakePeer;

class FakePeer {
  localDescription: { sdp: string } | null = null;
  remoteDescription: { type: string; sdp: string } | null = null;
  iceGatheringState = "complete";
  connectionState = "connected";
  tracks: unknown[] = [];
  channel!: FakeChannel;
  closed = false;
  offerSdp = "offer-sdp";
  ontrack: ((ev: { streams: unknown[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  constructor() {
    lastPeer = this;
  }

  addTrack(track: unknown): void {
    this.tracks.push(track);
  }

  createDataChannel(label: string): FakeChannel {
    this.channel = new FakeChannel(label);
    return this.channel;
  }

  async createOffer(): Promise<{ type: string; sdp: string }> {
    return { type: "offer", sdp: this.offerSdp };
  }

  async setLocalDescription(description: { sdp: string }): Promise<void> {
    this.localDescription = description;
  }

  async setRemoteDescription(description: { type: string; sdp: string }): Promise<void> {
    this.remoteDescription = description;
  }

  addEventListener(): void {}

  removeEventListener(): void {}

  close(): void {
    this.closed = true;
  }

  drop(state: "failed" | "disconnected" | "closed"): void {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

let lastAudioContext: FakeAudioContext | null;
let lastAnalyser: object | null;

class FakeAudioContext {
  streamSources: unknown[] = [];
  resumed = false;
  closed = false;

  constructor() {
    lastAudioContext = this;
  }

  createAnalyser(): object {
    lastAnalyser = { fftSize: 2048, smoothingTimeConstant: 0.8 };
    return lastAnalyser;
  }

  createMediaStreamSource(stream: unknown): { connect(): void; disconnect(): void } {
    this.streamSources.push(stream);
    return { connect: () => undefined, disconnect: () => undefined };
  }

  async resume(): Promise<void> {
    this.resumed = true;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

let calls: Call[];
let routes: Route[];
let onEvent: Mock<(event: DtoChatTimelineEvent) => void>;
let getUserMedia: ReturnType<typeof vi.fn>;
let audioTrack: { stop: ReturnType<typeof vi.fn>; enabled: boolean };
let fakeWindow: EventTarget & { self?: unknown; top?: unknown; AudioContext?: unknown };
let storage: Map<string, string>;

const TURN = { systemPrompt: "You answer questions about notes.", nativeTools: [{ name: "storage_query" as const }] };

function answerCall(call: Call): Response | Promise<Response> {
  for (const route of routes) {
    const answer = route(call);
    if (answer !== undefined) return answer;
  }
  if (call.method === "POST" && call.path === SESSIONS_PATH) {
    return json(201, {
      liveSessionId: LIVE_SESSION,
      answerSdp: "answer-sdp",
      expiresAt: "2026-11-03T12:00:00Z",
      sessionId: (call.body.sessionId as string | undefined) ?? NEW_SESSION,
    });
  }
  if (call.method === "POST" && call.path === MESSAGES_PATH) {
    const stream = new TurnStream(call.signal);
    streams.push(stream);
    return stream.response;
  }
  if (call.path === "/oauth/token") {
    return json(200, { access_token: "renewed-access", refresh_token: "renewed-refresh", expires_in: 300, scope: "openid" });
  }
  return new Response(null, { status: call.path === "/oauth/revoke" ? 200 : 204 });
}

let streams: TurnStream[];

function callsTo(method: string, path: string): Call[] {
  return calls.filter((call) => call.method === method && call.path === path);
}

function messageCalls(): Call[] {
  return callsTo("POST", MESSAGES_PATH);
}

function lineCalls(): { speaker: unknown; content: unknown }[] {
  return callsTo("POST", LINES_PATH).map((call) => call.body as { speaker: unknown; content: unknown });
}

function deleteCalls(): Call[] {
  return callsTo("DELETE", LIVE_SESSION_PATH);
}

function storeSession(expiresAt = Date.now() + 3_600_000): void {
  storage.set(
    `oaiz.auth.${APP}`,
    JSON.stringify({ accessToken: "app-access", refreshToken: "refresh", expiresAt, scope: "openid" }),
  );
}

function appClient() {
  return createClient({ url: API_URL, app: APP, database: "db-1" });
}

function createVoice(options: Partial<OaizVoiceOptions> = {}) {
  const client = appClient();
  return { client, voice: client.chat.voice({ turn: () => TURN, onEvent, ...options }) };
}

async function startVoice(options: Partial<OaizVoiceOptions> = {}) {
  const created = createVoice(options);
  const answer = await created.voice.start({ sessionId: SESSION });
  expect(answer.error).toBeNull();
  return { ...created, answer };
}

function emit(event: Record<string, unknown>): void {
  lastPeer.channel.onmessage?.({ data: JSON.stringify(event) });
}

function speak(words: string): void {
  emit({ type: "session.input_transcript.delta", delta: words });
}

function reply(words: string): void {
  emit({ type: "session.output_transcript.delta", delta: words });
}

function delegate(id: string): void {
  emit({ type: "session.delegation.created", delegation: { id, type: "delegation", target: "client" } });
}

function sentEvents(): Record<string, unknown>[] {
  return lastPeer.channel.sent.map((raw) => JSON.parse(raw) as Record<string, unknown>);
}

function sentOfType(type: string): Record<string, unknown>[] {
  return sentEvents().filter((event) => event.type === type);
}

function pageLeave(persisted: boolean): void {
  fakeWindow.dispatchEvent(Object.assign(new Event("pagehide"), { persisted }));
}

/** Starts one delegated turn and answers once its stream is open. */
async function runningTurn(words = "list my notes", id = "item_1"): Promise<TurnStream> {
  const before = streams.length;
  speak(words);
  delegate(id);
  await vi.waitFor(() => expect(streams.length).toBe(before + 1));
  return streams[before];
}

function toolMessage(messageType: string, call: Record<string, unknown>): Record<string, unknown> {
  return {
    type: messageType === "tool_started" ? "message.created" : "message.updated",
    message: {
      id: "tool-1",
      role: "assistant",
      content: "",
      createdAt: "2026-11-03T12:00:00Z",
      messageType,
      artifacts: [{ toolCallResult: { toolCallId: "call-1", success: true, ...call } }],
    },
  };
}

beforeEach(() => {
  calls = [];
  routes = [];
  streams = [];
  lastAudioContext = null;
  lastAnalyser = null;
  onEvent = vi.fn<(event: DtoChatTimelineEvent) => void>();
  audioTrack = { stop: vi.fn(), enabled: true };
  const mediaStream = { getTracks: () => [audioTrack], getAudioTracks: () => [audioTrack] };
  getUserMedia = vi.fn(async () => mediaStream);

  storage = new Map();
  storeSession();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
  vi.stubGlobal("location", { href: "https://notes.example.com/", assign: vi.fn() });
  vi.stubGlobal("history", { state: null, replaceState: vi.fn() });

  fakeWindow = new EventTarget();
  fakeWindow.self = fakeWindow;
  fakeWindow.top = fakeWindow;
  fakeWindow.AudioContext = FakeAudioContext;
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("document", {
    createElement: () => ({ autoplay: false, srcObject: null, remove: () => undefined }),
  });
  vi.stubGlobal("RTCPeerConnection", FakePeer);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const raw = typeof init.body === "string" ? init.body : "";
      const call: Call = {
        method: init.method ?? "GET",
        path: new URL(url).pathname,
        body: raw.startsWith("{") ? (JSON.parse(raw) as Record<string, unknown>) : {},
        headers: (init.headers ?? {}) as Record<string, string>,
        keepalive: init.keepalive === true,
        signal: init.signal ?? null,
      };
      calls.push(call);
      return answerCall(call);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("chat.voice start", () => {
  it("exchanges the browser offer for the provider answer through Core", async () => {
    const { voice, answer } = await startVoice({ instructions: "A notes app." });

    const [open] = callsTo("POST", SESSIONS_PATH);
    expect(open.body).toEqual({ sessionId: SESSION, offerSdp: "offer-sdp", instructions: "A notes app." });
    expect(open.headers).toMatchObject({ Authorization: "Bearer app-access" });
    expect(lastPeer.remoteDescription).toEqual({ type: "answer", sdp: "answer-sdp" });
    expect(lastPeer.channel.label).toBe("oai-events");
    expect(lastPeer.tracks).toEqual([audioTrack]);
    expect(answer).toEqual({ data: { sessionId: SESSION }, error: null, count: null, status: 201 });
    expect(voice.getSnapshot()).toMatchObject({ state: "live", sessionId: SESSION, error: null, muted: false });
  });

  it("joins the chat Core opens when none is named", async () => {
    const { voice } = createVoice();

    const answer = await voice.start();

    expect(callsTo("POST", SESSIONS_PATH)[0].body).toEqual({ offerSdp: "offer-sdp" });
    expect(answer.data).toEqual({ sessionId: NEW_SESSION });
    expect(voice.getSnapshot().sessionId).toBe(NEW_SESSION);
  });

  it("notifies subscribers and keeps one snapshot object until something changes", async () => {
    const { voice } = await startVoice();
    const listener = vi.fn();
    const unsubscribe = voice.subscribe(listener);
    const before = voice.getSnapshot();

    expect(voice.getSnapshot()).toBe(before);
    voice.toggleMute();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(voice.getSnapshot()).not.toBe(before);

    unsubscribe();
    voice.toggleMute();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("refuses a second start while the conversation runs", async () => {
    const { voice } = await startVoice();

    const answer = await voice.start({ sessionId: SESSION });

    expect(answer.error?.code).toBe("voice-already-started");
    expect(callsTo("POST", SESSIONS_PATH)).toHaveLength(1);
    expect(voice.getSnapshot().state).toBe("live");
  });

  it("answers a stable slug where the browser has no microphone API", async () => {
    vi.stubGlobal("navigator", {});
    const { voice } = createVoice();

    const answer = await voice.start({ sessionId: SESSION });

    expect(answer).toMatchObject({ data: null, status: 0, error: { code: "voice-browser-required" } });
    expect(voice.getSnapshot()).toMatchObject({ state: "idle", error: { code: "voice-browser-required" } });
    expect(calls).toEqual([]);
  });

  it.each([
    ["NotAllowedError", "voice-microphone-blocked"],
    ["SecurityError", "voice-microphone-blocked"],
    ["NotFoundError", "voice-microphone-not-found"],
    ["DevicesNotFoundError", "voice-microphone-not-found"],
    ["NotReadableError", "voice-microphone-in-use"],
    ["TrackStartError", "voice-microphone-in-use"],
    ["OverconstrainedError", "voice-microphone-unsupported"],
    ["AbortError", "voice-microphone-interrupted"],
    ["TypeError", "voice-microphone-failed"],
  ])("maps a %s from the browser to %s and opens no call", async (name, code) => {
    getUserMedia.mockRejectedValueOnce(new DOMException("denied", name));
    const { voice } = createVoice();

    const answer = await voice.start({ sessionId: SESSION });

    expect(answer).toMatchObject({ data: null, status: 0, error: { code } });
    expect(voice.getSnapshot()).toMatchObject({ state: "idle", error: { code } });
    expect(callsTo("POST", SESSIONS_PATH)).toEqual([]);
  });

  it.each(["NotAllowedError", "SecurityError"])("explains a %s inside a frame with a stable slug", async (name) => {
    fakeWindow.top = {};
    getUserMedia.mockRejectedValueOnce(new DOMException("denied", name));
    const { voice } = createVoice();

    const answer = await voice.start({ sessionId: SESSION });

    expect(answer.error?.code).toBe("voice-microphone-in-frame");
    expect(answer.error?.message).toContain("in its own tab");
    expect(voice.getSnapshot().error?.code).toBe("voice-microphone-in-frame");
  });

  it("answers Core's refusal with its status and slug, and leaves nothing running", async () => {
    routes.push((call) =>
      call.method === "POST" && call.path === SESSIONS_PATH ? refusal(429, "live-voice-user-limit-reached") : undefined,
    );
    const { voice } = createVoice();

    const answer = await voice.start({ sessionId: SESSION });

    expect(answer).toMatchObject({ data: null, status: 429, error: { code: "live-voice-user-limit-reached" } });
    expect(voice.getSnapshot()).toMatchObject({ state: "idle", error: { code: "live-voice-user-limit-reached" } });
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(lastPeer.closed).toBe(true);
    expect(calls.filter((call) => call.method === "DELETE")).toEqual([]);
  });

  it("releases the session when the provider answer cannot be applied", async () => {
    const setRemoteDescription = vi
      .spyOn(FakePeer.prototype, "setRemoteDescription")
      .mockRejectedValueOnce(new Error("bad answer"));
    const { voice } = createVoice();

    const answer = await voice.start({ sessionId: SESSION });

    expect(setRemoteDescription).toHaveBeenCalled();
    expect(answer).toMatchObject({ data: null, status: 0, error: { message: "bad answer" } });
    expect(deleteCalls()).toHaveLength(1);
    expect(voice.getSnapshot().state).toBe("idle");
    expect(audioTrack.stop).toHaveBeenCalled();
  });

  it("answers a stable slug when the browser produces no offer", async () => {
    vi.spyOn(FakePeer.prototype, "createOffer").mockResolvedValueOnce({ type: "offer", sdp: "" });
    const { voice } = createVoice();

    const answer = await voice.start({ sessionId: SESSION });

    expect(answer.error?.code).toBe("voice-no-webrtc-offer");
    expect(callsTo("POST", SESSIONS_PATH)).toEqual([]);
    expect(voice.getSnapshot().state).toBe("idle");
    expect(audioTrack.stop).toHaveBeenCalled();
  });

  it("keeps a mute clicked during the permission prompt", async () => {
    let grant: (stream: unknown) => void = () => undefined;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => (grant = resolve)));
    const { voice } = createVoice();

    const starting = voice.start({ sessionId: SESSION });
    voice.toggleMute();
    grant({ getTracks: () => [audioTrack], getAudioTracks: () => [audioTrack] });
    await starting;

    expect(voice.getSnapshot()).toMatchObject({ state: "live", muted: true });
    expect(audioTrack.enabled).toBe(false);
  });

  it("stops the microphone when stop is pressed during the permission prompt", async () => {
    let grant: (stream: unknown) => void = () => undefined;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => (grant = resolve)));
    const { voice } = createVoice();

    const starting = voice.start({ sessionId: SESSION });
    const stopped = voice.stop();
    expect(voice.getSnapshot().state).toBe("closing");
    grant({ getTracks: () => [audioTrack], getAudioTracks: () => [audioTrack] });

    expect((await starting).error).toBeNull();
    await stopped;
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(voice.getSnapshot()).toMatchObject({ state: "idle", error: null });
    expect(callsTo("POST", SESSIONS_PATH)).toEqual([]);
  });

  it("releases a session the member ended while Core was still answering", async () => {
    let answerCore: (response: Response) => void = () => undefined;
    routes.push((call) =>
      call.method === "POST" && call.path === SESSIONS_PATH
        ? new Promise<Response>((resolve) => (answerCore = resolve))
        : undefined,
    );
    const { voice } = createVoice();

    const starting = voice.start();
    await vi.waitFor(() => expect(callsTo("POST", SESSIONS_PATH)).toHaveLength(1));
    const stopped = voice.stop();
    expect(voice.getSnapshot().state).toBe("closing");

    answerCore(json(201, { liveSessionId: LIVE_SESSION, answerSdp: "answer-sdp", expiresAt: "", sessionId: NEW_SESSION }));
    const answer = await starting;
    await stopped;

    expect(answer).toEqual({ data: { sessionId: NEW_SESSION }, error: null, count: null, status: 200 });
    expect(voice.getSnapshot()).toMatchObject({ state: "idle", error: null });
    expect(deleteCalls()).toHaveLength(1);
    expect(lastPeer.remoteDescription).toBeNull();
  });

  it("releases a session the member ended while the answer was being applied", async () => {
    let applied: () => void = () => undefined;
    vi.spyOn(FakePeer.prototype, "setRemoteDescription").mockImplementationOnce(
      () => new Promise<void>((resolve) => (applied = resolve)),
    );
    const { voice } = createVoice();

    const starting = voice.start({ sessionId: SESSION });
    await vi.waitFor(() => expect(voice.getSnapshot().sessionId).toBe(SESSION));
    await vi.waitFor(() => expect(callsTo("POST", SESSIONS_PATH)).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve));
    const stopped = voice.stop();
    applied();
    await Promise.all([starting, stopped]);

    expect(voice.getSnapshot().state).toBe("idle");
    expect(deleteCalls()).toHaveLength(1);
    expect(audioTrack.stop).toHaveBeenCalled();
  });

  it("hands the recent chat to the voice model once the session is up", async () => {
    const { voice } = createVoice();
    await voice.start({ sessionId: SESSION, recentContext: "  User: hello\nAssistant: Hi.  " });
    expect(sentEvents()).toEqual([]);

    emit({ type: "session.started" });
    emit({ type: "session.started" });

    expect(sentOfType("session.thinking.append")).toEqual([
      expect.objectContaining({
        delegation_id: null,
        content: "Recent chat before this voice session:\nUser: hello\nAssistant: Hi.",
      }),
    ]);
  });

  it("taps the remote playback track with one analyser per call and closes it at the end", async () => {
    const { voice } = await startVoice();
    const remote = {};

    lastPeer.ontrack?.({ streams: [remote] });

    expect(voice.getSnapshot().outputAnalyser).toBe(lastAnalyser);
    expect(lastAudioContext?.streamSources).toEqual([remote]);
    expect(lastAudioContext?.resumed).toBe(true);

    const stopped = voice.stop();
    emit({ type: "session.closed" });
    await stopped;

    expect(voice.getSnapshot().outputAnalyser).toBeNull();
    expect(lastAudioContext?.closed).toBe(true);
  });
});

describe("chat.voice delegations", () => {
  it("runs a delegation as a chat turn with the turn's own tools and speaks the answer", async () => {
    await startVoice();

    const stream = await runningTurn("list my ", "item_9tA2bF3h");
    const [message] = messageCalls();
    expect(message.headers).toMatchObject({ Authorization: "Bearer app-access", Accept: "text/event-stream" });
    expect(message.body).toEqual({
      ...TURN,
      content: "list my",
      sessionId: SESSION,
      clientMessageId: expect.stringMatching(UUID_PATTERN),
      type: "voice_delegation",
      voiceDelegationId: "item_9tA2bF3h",
    });

    stream.push({ type: "message.delta", delta: { messageId: "m-1", content: "Seven." } });
    stream.finish({ delegationId: "item_9tA2bF3h", speech: "You have seven notes.", context: "Notes: one, two." });

    await vi.waitFor(() =>
      expect(sentOfType("session.commentary.append")).toEqual([
        expect.objectContaining({ delegation_id: "item_9tA2bF3h", content: "You have seven notes." }),
      ]),
    );
    expect(sentEvents().filter((event) => event.delegation_id === "item_9tA2bF3h").map((event) => event.type)).toEqual([
      "session.thinking.append",
      "session.commentary.append",
    ]);
    expect(sentOfType("session.thinking.append")[0].content).toBe("Written answer shown on screen:\nNotes: one, two.");
    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual([
      "message.created",
      "message.delta",
      "generation.finished",
      "voice.delegationResult",
    ]);
  });

  it("reports the spoken request as the member's message, under the id the turn sends", async () => {
    await startVoice();

    await runningTurn("list my notes", "item_1");

    const clientMessageId = messageCalls()[0].body?.clientMessageId;
    expect(clientMessageId).toEqual(expect.any(String));
    expect(onEvent.mock.calls[0][0]).toEqual({
      type: "message.created",
      message: {
        id: clientMessageId,
        clientMessageId,
        role: "user",
        messageType: "user_input",
        content: "list my notes",
        createdAt: expect.any(String),
      },
    });
  });

  it("reads the turn's tools for each delegation", async () => {
    let nativeTools: DtoAppChatNativeTool[] = [{ name: "storage_query" }];
    await startVoice({ turn: () => ({ systemPrompt: "Be brief.", nativeTools }) });

    const first = await runningTurn("first", "item_1");
    first.finish({ delegationId: "item_1", speech: "One." });
    await vi.waitFor(() => expect(sentOfType("session.commentary.append")).toHaveLength(1));

    nativeTools = [];
    await runningTurn("second", "item_2");

    expect(messageCalls().map((call) => call.body.nativeTools)).toEqual([[{ name: "storage_query" }], []]);
  });

  it("names each turn's source, so a spoken and a typed turn can have their own tools", async () => {
    const turn = vi.fn((source: OaizVoiceTurnSource) => ({
      systemPrompt: "Be brief.",
      nativeTools: (source === "spoken"
        ? [{ name: "storage_query" }]
        : [{ name: "storage_query" }, { name: "storage_execute", requireApproval: true }]) as DtoAppChatNativeTool[],
    }));
    const { voice } = await startVoice({ turn });

    const spoken = await runningTurn("list my notes", "item_1");
    spoken.finish({ delegationId: "item_1", speech: "One." });
    await vi.waitFor(() => expect(sentOfType("session.commentary.append")).toHaveLength(1));
    voice.send("add a note");
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(2));

    expect(turn.mock.calls).toEqual([["spoken"], ["typed"]]);
    expect(messageCalls().map((call) => call.body.nativeTools)).toEqual([
      [{ name: "storage_query" }],
      [{ name: "storage_query" }, { name: "storage_execute", requireApproval: true }],
    ]);
  });

  it("runs no turn for a delegation that arrives after the member ended the call", async () => {
    const { voice } = await startVoice();

    const stopped = voice.stop();
    speak("and delete every note");
    delegate("item_late");
    await new Promise((resolve) => setTimeout(resolve));

    expect(messageCalls()).toEqual([]);
    expect(onEvent).not.toHaveBeenCalled();
    expect(voice.getSnapshot().turnRunning).toBe(false);

    emit({ type: "session.closed" });
    await stopped;
    expect(messageCalls()).toEqual([]);
  });

  it("runs no turn for a delegation with no pending speech", async () => {
    await startVoice();
    const replySpoken = "I will look that up for you.";

    reply(replySpoken);
    delegate("item_model_only");
    await new Promise((resolve) => setTimeout(resolve));

    expect(messageCalls()).toEqual([]);
    expect(lineCalls()).toEqual([]);
  });

  it("starts a fresh request after each delegation", async () => {
    await startVoice();

    const first = await runningTurn("first request", "item_1");
    speak("second request");
    delegate("item_2");
    first.finish({ delegationId: "item_1", speech: "One." });
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(2));

    expect(messageCalls().map((call) => [call.body.content, call.body.voiceDelegationId])).toEqual([
      ["first request", "item_1"],
      ["second request", "item_2"],
    ]);
  });

  it("writes only what the voice model is saying, not the member", async () => {
    const { voice } = await startVoice();

    speak("hello ");
    speak("there");
    reply("Hi");
    reply(" there");
    expect(voice.getSnapshot().assistantSpeech).toBe("Hi there");

    speak("thanks");
    expect(voice.getSnapshot().assistantSpeech).toBe("");
  });

  it("narrates tool steps as silent context from the turn's own stream", async () => {
    await startVoice();

    const stream = await runningTurn("make a note", "item_work");
    stream.push(toolMessage("tool_started", { toolName: "create_note", displayName: "Create note" }));
    // A parallel copy of the same step and a clean finish add nothing.
    stream.push(toolMessage("tool_started", { toolName: "create_note", displayName: "Create note" }));
    stream.push(toolMessage("tool_finished", { toolName: "create_note", success: true }));
    stream.push(toolMessage("tool_finished", { toolName: "create_note", success: false }));
    stream.push({ type: "message.created", message: { id: "m-2", role: "assistant", content: "Done", createdAt: "", messageType: "ai_response" } });
    stream.finish({ delegationId: "item_work", speech: "Done." });
    await vi.waitFor(() => expect(sentOfType("session.commentary.append")).toHaveLength(1));

    expect(sentOfType("session.thinking.append")).toEqual([
      expect.objectContaining({ delegation_id: "item_work", content: "Backend step started: Create note" }),
      expect.objectContaining({ delegation_id: "item_work", content: "Backend step failed: create note" }),
    ]);
  });

  it("forwards no commentary when the turn returns no speech", async () => {
    await startVoice();

    const stream = await runningTurn();
    stream.finish({ delegationId: "item_1", speech: "" });
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(3));

    expect(sentOfType("session.commentary.append")).toEqual([]);
  });
});

describe("chat.voice turn queue", () => {
  it("runs spoken and typed turns one at a time, in order", async () => {
    const { voice } = await startVoice();

    const first = await runningTurn("first", "item_1");
    speak("second");
    delegate("item_2");
    voice.send("third");
    await new Promise((resolve) => setTimeout(resolve));
    expect(messageCalls()).toHaveLength(1);

    first.finish({ delegationId: "item_1", speech: "One." });
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve));
    expect(messageCalls()).toHaveLength(2);

    streams[1].finish({ delegationId: "item_2", speech: "Two." });
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(3));

    expect(messageCalls().map((call) => call.body.content)).toEqual(["first", "second", "third"]);
  });

  it("stops only the running turn, tells the voice model, and runs the next", async () => {
    const { voice } = await startVoice();

    const first = await runningTurn("first", "item_1");
    speak("second");
    delegate("item_2");

    voice.stopTurn();

    await vi.waitFor(() => expect(messageCalls()).toHaveLength(2));
    expect(messageCalls()[0].signal?.aborted).toBe(true);
    expect(messageCalls()[1].signal?.aborted).toBe(false);
    expect(first).toBeDefined();
    expect(sentOfType("session.commentary.append")).toEqual([
      expect.objectContaining({ delegation_id: "item_1", content: STOPPED_SPEECH }),
    ]);
    expect(voice.getSnapshot()).toMatchObject({ state: "live", error: null });
  });

  it("closes the running turn and drops the waiting turns on stopAllTurns", async () => {
    const { voice } = await startVoice();

    const first = await runningTurn("first", "item_1");
    speak("second");
    delegate("item_2");

    voice.stopAllTurns();
    expect(() => first.push({ type: "message.delta" })).toThrow();

    await vi.waitFor(() => expect(voice.getSnapshot().turnRunning).toBe(false));
    expect(messageCalls()).toHaveLength(1);
    expect(messageCalls()[0].signal?.aborted).toBe(true);
    expect(voice.getSnapshot().state).toBe("live");
  });

  it("passes no event on from a turn that was stopped", async () => {
    const { voice } = await startVoice();

    const stream = await runningTurn();
    stream.push({ type: "generation.started" });
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(2));
    stream.push({ type: "message.delta", delta: { messageId: "m-1", content: "Late." } });
    voice.stopTurn();

    await vi.waitFor(() => expect(voice.getSnapshot().turnRunning).toBe(false));
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it("reports a turn as running until the last waiting turn ends, also past the call", async () => {
    const { voice } = await startVoice();
    expect(voice.getSnapshot().turnRunning).toBe(false);

    const first = await runningTurn("first", "item_1");
    speak("second");
    delegate("item_2");
    expect(voice.getSnapshot().turnRunning).toBe(true);

    const stopped = voice.stop();
    emit({ type: "session.closed" });
    await stopped;
    expect(voice.getSnapshot()).toMatchObject({ state: "idle", turnRunning: true });

    first.finish({ delegationId: "item_1", speech: "One." });
    await vi.waitFor(() => expect(streams).toHaveLength(2));
    expect(voice.getSnapshot().turnRunning).toBe(true);

    streams[1].finish({ delegationId: "item_2", speech: "Two." });
    await vi.waitFor(() => expect(voice.getSnapshot().turnRunning).toBe(false));
  });

  it("does nothing on stopTurn when no turn runs", async () => {
    const { voice } = await startVoice();

    voice.stopTurn();

    expect(sentEvents()).toEqual([]);
  });
});

describe("chat.voice failed turns", () => {
  it("answers the voice model and reports the error when a stream ends with no result", async () => {
    const { voice } = await startVoice();

    const stream = await runningTurn();
    stream.push({ type: "generation.finished" });
    stream.end();

    await vi.waitFor(() =>
      expect(sentOfType("session.commentary.append")).toEqual([
        expect.objectContaining({ delegation_id: "item_1", content: FAILED_SPEECH }),
      ]),
    );
    expect(voice.getSnapshot()).toMatchObject({ state: "live", error: { code: "voice-turn-ended" } });
  });

  it("answers the voice model and reports Core's slug when a turn is refused", async () => {
    routes.push((call) => (call.path === MESSAGES_PATH ? refusal(402, "budget-exceeded") : undefined));
    const { voice } = await startVoice();

    speak("list my notes");
    delegate("item_1");

    await vi.waitFor(() => expect(sentOfType("session.commentary.append")).toHaveLength(1));
    expect(sentOfType("session.commentary.append")[0].content).toBe(FAILED_SPEECH);
    expect(voice.getSnapshot()).toMatchObject({ state: "live", error: { code: "budget-exceeded" } });
    expect(sentOfType("session.thinking.append")).toEqual([]);
  });

  it("answers the voice model when the network drops mid-stream", async () => {
    let drop: () => void = () => undefined;
    routes.push((call) => {
      if (call.path !== MESSAGES_PATH) return undefined;
      const body = new ReadableStream<Uint8Array>({
        start: (controller) => {
          drop = () => controller.error(new TypeError("network error"));
        },
      });
      return new Response(body, { status: 200 });
    });
    const { voice } = await startVoice();

    speak("list my notes");
    delegate("item_1");
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve));
    drop();

    await vi.waitFor(() => expect(sentOfType("session.commentary.append")).toHaveLength(1));
    expect(voice.getSnapshot().error?.message).toBe("network error");
  });

  it("answers the voice model when the author's turn callback throws", async () => {
    const { voice } = await startVoice({
      turn: () => {
        throw new Error("no prompt");
      },
    });

    speak("list my notes");
    delegate("item_1");

    await vi.waitFor(() => expect(sentOfType("session.commentary.append")).toHaveLength(1));
    expect(messageCalls()).toEqual([]);
    expect(voice.getSnapshot().error?.message).toBe("no prompt");
  });

  it("clears a turn's error when the next turn starts", async () => {
    routes.push((call) =>
      call.path === MESSAGES_PATH && messageCalls().length === 1 ? refusal(402, "budget-exceeded") : undefined,
    );
    const { voice } = await startVoice();

    speak("first");
    delegate("item_1");
    await vi.waitFor(() => expect(voice.getSnapshot().error?.code).toBe("budget-exceeded"));

    await runningTurn("second", "item_2");

    expect(voice.getSnapshot().error).toBeNull();
  });
});

describe("chat.voice send", () => {
  it("reports a typed message at once, also behind a running turn", async () => {
    const { voice } = await startVoice();
    await runningTurn();

    voice.send("typed while it works");

    expect(onEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "message.created",
        message: expect.objectContaining({ role: "user", content: "typed while it works" }),
      }),
    );
    expect(messageCalls()).toHaveLength(1);
  });

  it("tells the voice model what the member typed and speaks that answer to the session", async () => {
    const { voice } = await startVoice();

    expect(voice.send("oaiz.io")).toEqual({ error: null });

    expect(sentOfType("session.thinking.append")).toEqual([
      expect.objectContaining({ delegation_id: null, content: "The user typed this in the chat window: oaiz.io" }),
    ]);
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    expect(messageCalls()[0].body).toEqual({
      ...TURN,
      content: "oaiz.io",
      sessionId: SESSION,
      clientMessageId: expect.stringMatching(UUID_PATTERN),
      type: "voice_delegation",
    });

    streams[0].push(toolMessage("tool_started", { toolName: "web_search" }));
    streams[0].finish({ delegationId: "", speech: "It is a website.", context: "A site about agents." });

    await vi.waitFor(() =>
      expect(sentOfType("session.commentary.append")).toEqual([
        expect.objectContaining({ delegation_id: null, content: "It is a website." }),
      ]),
    );
    expect(sentOfType("session.thinking.append").map((event) => event.delegation_id)).toEqual([null, null, null]);
    expect(sentOfType("session.thinking.append")[1].content).toBe("Backend step started: web search");
  });

  it("records what was spoken before the typed message first", async () => {
    const { voice } = await startVoice();

    speak("hold on");
    reply("Sure thing.");
    voice.send("typed");
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(1));

    expect(lineCalls()).toEqual([
      { speaker: "user", content: "hold on" },
      { speaker: "assistant", content: "Sure thing." },
    ]);
  });

  it("tells the voice model when OAIZ refused the typed message", async () => {
    routes.push((call) => (call.path === MESSAGES_PATH ? refusal(400, "invalid-app-chat-message") : undefined));
    const { voice } = await startVoice();

    voice.send("typed");

    await vi.waitFor(() => expect(sentOfType("session.commentary.append")).toHaveLength(1));
    expect(sentEvents().map((event) => event.content)).toEqual([
      "The user typed this in the chat window: typed",
      "The typed message was not sent. No answer is coming for it.",
      FAILED_SPEECH,
    ]);
    expect(voice.getSnapshot().error?.code).toBe("invalid-app-chat-message");
  });

  it("answers an error and sends nothing while no call is live", () => {
    const { voice } = createVoice();

    expect(voice.send("hello").error?.code).toBe("voice-not-live");
    expect(calls).toEqual([]);
  });
});

describe("chat.voice spoken lines", () => {
  it("sends the request as the member's words only and ignores backchannels", async () => {
    await startVoice();

    speak("so I want you to");
    reply("Mm-h");
    speak(" understand my tone of");
    reply("mm.");
    speak(" voice");
    delegate("item_words");
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(1));

    expect(messageCalls()[0].body.content).toBe("so I want you to understand my tone of voice");
    // Fillers are still history; they just do not cut the member's request.
    expect(lineCalls()).toEqual([
      { speaker: "assistant", content: "Mm-h" },
      { speaker: "assistant", content: "mm." },
    ]);
  });

  it("records both lines when the voice really replied, then starts a fresh request", async () => {
    await startVoice();

    speak("hello there");
    reply("Hi! I'm doing well. What's up?");
    speak("list my notes");
    delegate("item_after_chat");
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(1));

    expect(lineCalls()).toEqual([
      { speaker: "user", content: "hello there" },
      { speaker: "assistant", content: "Hi! I'm doing well. What's up?" },
    ]);
    expect(messageCalls()[0].body.content).toBe("list my notes");
  });

  it("keeps a holding phrase pending until the next boundary", async () => {
    await startVoice();

    speak("list my notes");
    delegate("item_1");
    reply("Let me check that.");
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(1));
    expect(lineCalls()).toEqual([]);

    speak("thanks");

    await vi.waitFor(() => expect(lineCalls()).toEqual([{ speaker: "assistant", content: "Let me check that." }]));
  });

  it("posts lines one at a time, in spoken order, however slow the first answer is", async () => {
    let answerFirst: (response: Response) => void = () => undefined;
    routes.push((call) =>
      call.path === LINES_PATH && lineCalls().length === 1
        ? new Promise<Response>((resolve) => (answerFirst = resolve))
        : undefined,
    );
    await startVoice();

    speak("hello there");
    reply("Hi! What can I do for you today?");
    speak("more");
    await vi.waitFor(() => expect(lineCalls()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve));
    expect(lineCalls()).toHaveLength(1);

    answerFirst(new Response(null, { status: 204 }));

    await vi.waitFor(() => expect(lineCalls()).toHaveLength(2));
    expect(lineCalls().map((line) => line.speaker)).toEqual(["user", "assistant"]);
  });

  it("starts a turn only after the lines spoken before it reached Core", async () => {
    let answerLine: (response: Response) => void = () => undefined;
    routes.push((call) =>
      call.path === LINES_PATH ? new Promise<Response>((resolve) => (answerLine = resolve)) : undefined,
    );
    await startVoice();

    reply("A backchannel line here.");
    speak("list my notes");
    delegate("item_1");
    await vi.waitFor(() => expect(lineCalls()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve));
    expect(messageCalls()).toEqual([]);

    answerLine(new Response(null, { status: 204 }));

    await vi.waitFor(() => expect(messageCalls()).toHaveLength(1));
  });

  it("does not hold a turn back for a line that does not answer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    routes.push((call) => (call.path === LINES_PATH ? new Promise<Response>(() => undefined) : undefined));
    await startVoice();

    reply("A backchannel line here.");
    speak("list my notes");
    delegate("item_1");
    await vi.advanceTimersByTimeAsync(1_999);
    expect(messageCalls()).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);

    expect(messageCalls()).toHaveLength(1);
  });

  it("keeps the call when a line is refused, and holds the speech out of the console", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    routes.push((call) => (call.path === LINES_PATH ? refusal(409, "voice-line-no-active-session") : undefined));
    const { voice } = await startVoice();

    speak("my secret words");
    reply("I heard your secret words.");
    speak("more");

    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
    expect(warn).toHaveBeenCalledWith("spoken line not recorded", { status: 409, code: "voice-line-no-active-session" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
    expect(voice.getSnapshot()).toMatchObject({ state: "live", error: null });
  });

  it("holds an unreadable provider event out of the console", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await startVoice();

    lastPeer.channel.onmessage?.({ data: "my secret words" });

    expect(error).toHaveBeenCalledWith("unparsable live voice event");
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret");
  });
});

describe("chat.voice stop", () => {
  it("asks the provider to close, waits for session.closed, then releases", async () => {
    const { voice } = await startVoice();

    const stopped = voice.stop();

    expect(voice.getSnapshot().state).toBe("closing");
    expect(sentOfType("session.close")).toHaveLength(1);
    expect(deleteCalls()).toEqual([]);
    expect(audioTrack.stop).not.toHaveBeenCalled();

    emit({ type: "session.closed" });
    await stopped;

    expect(deleteCalls()).toHaveLength(1);
    expect(deleteCalls()[0].headers).toMatchObject({ Authorization: "Bearer app-access" });
    expect(lastPeer.closed).toBe(true);
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(voice.getSnapshot()).toMatchObject({ state: "idle", sessionId: null, assistantSpeech: "" });
  });

  it("releases after a bound when session.closed never arrives", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { voice } = await startVoice();

    void voice.stop();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(deleteCalls()).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);

    expect(voice.getSnapshot().state).toBe("idle");
    await vi.waitFor(() => expect(deleteCalls()).toHaveLength(1));
  });

  it("records what is still pending, then releases after the lines reached Core", async () => {
    let answerLine: (response: Response) => void = () => undefined;
    routes.push((call) =>
      call.path === LINES_PATH && lineCalls().length === 2
        ? new Promise<Response>((resolve) => (answerLine = resolve))
        : undefined,
    );
    const { voice } = await startVoice();

    speak("thanks, bye");
    reply("Bye for now, talk soon.");
    const stopped = voice.stop();
    emit({ type: "session.closed" });
    await vi.waitFor(() => expect(lineCalls()).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve));
    expect(deleteCalls()).toEqual([]);

    answerLine(new Response(null, { status: 204 }));
    await stopped;

    expect(lineCalls()).toEqual([
      { speaker: "user", content: "thanks, bye" },
      { speaker: "assistant", content: "Bye for now, talk soon." },
    ]);
    expect(deleteCalls()).toHaveLength(1);
  });

  it("releases after a bound when a line does not answer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    routes.push((call) => (call.path === LINES_PATH ? new Promise<Response>(() => undefined) : undefined));
    const { voice } = await startVoice();

    speak("thanks, bye");
    void voice.stop();
    emit({ type: "session.closed" });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(deleteCalls()).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);

    expect(deleteCalls()).toHaveLength(1);
  });

  it.each([
    ["a result", (turn: TurnStream) => turn.finish({ delegationId: "item_1", speech: "Two notes.", context: "Two notes." })],
    ["no result", (turn: TurnStream) => turn.end()],
  ])("tells a later call nothing of a turn with %s that outlived its own call", async (_ending, end) => {
    const { voice } = await startVoice();
    const turn = await runningTurn();
    const stopping = voice.stop();
    emit({ type: "session.closed" });
    await stopping;

    expect((await voice.start({ sessionId: SESSION })).error).toBeNull();
    turn.push(toolMessage("tool_started", { toolName: "storage_query" }));
    end(turn);
    await vi.waitFor(() => expect(voice.getSnapshot().turnRunning).toBe(false));

    expect(sentEvents()).toEqual([]);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "message.created" }));
  });

  it("does not stop a running turn: it finishes into the chat", async () => {
    const { voice } = await startVoice();

    const stream = await runningTurn();
    speak("second");
    delegate("item_2");
    const stopped = voice.stop();
    emit({ type: "session.closed" });
    await stopped;

    expect(messageCalls()[0].signal?.aborted).toBe(false);
    stream.push({ type: "message.delta", delta: { messageId: "m-1", content: "Late." } });
    stream.finish({ delegationId: "item_1", speech: "Done." });

    await vi.waitFor(() => expect(messageCalls()).toHaveLength(2));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "message.delta" }));
    expect(messageCalls()[1].body).toMatchObject({ content: "second", sessionId: SESSION });
  });

  it("ends when the provider ends the session on its own", async () => {
    const { voice } = await startVoice();

    speak("are you there");
    emit({ type: "session.closed" });

    await vi.waitFor(() => expect(deleteCalls()).toHaveLength(1));
    expect(lineCalls()).toEqual([{ speaker: "user", content: "are you there" }]);
    expect(voice.getSnapshot().state).toBe("idle");
    expect(audioTrack.stop).toHaveBeenCalled();
  });

  it.each(["failed", "disconnected", "closed"] as const)(
    "stops the microphone and releases the session when the connection goes %s",
    async (state) => {
      const { voice } = await startVoice();
      expect(audioTrack.stop).not.toHaveBeenCalled();

      speak("are you there");
      lastPeer.drop(state);

      expect(audioTrack.stop).toHaveBeenCalled();
      expect(lastPeer.closed).toBe(true);
      expect(voice.getSnapshot().state).toBe("idle");
      await vi.waitFor(() => expect(deleteCalls()).toHaveLength(1));
      expect(lineCalls()).toEqual([{ speaker: "user", content: "are you there" }]);
    },
  );

  it("ignores events and connection changes from a call that has ended", async () => {
    const { voice } = await startVoice();
    const ended = lastPeer;
    const channel = ended.channel;
    const stopped = voice.stop();
    emit({ type: "session.closed" });
    await stopped;

    await voice.start({ sessionId: SESSION });
    const current = lastPeer;
    channel.onmessage?.({ data: JSON.stringify({ type: "session.closed" }) });
    ended.drop("failed");

    expect(voice.getSnapshot().state).toBe("live");
    expect(current.closed).toBe(false);
  });

  it("starts again after it stopped", async () => {
    const { voice } = await startVoice();
    const stopped = voice.stop();
    emit({ type: "session.closed" });
    await stopped;

    const answer = await voice.start({ sessionId: SESSION });

    expect(answer.error).toBeNull();
    expect(voice.getSnapshot().state).toBe("live");
  });

  it("does not go back to live on a late session.started", async () => {
    const { voice } = await startVoice();

    void voice.stop();
    emit({ type: "session.started" });

    expect(voice.getSnapshot().state).toBe("closing");
  });

  it("answers the same promise to a second stop", async () => {
    const { voice } = await startVoice();

    const stopped = voice.stop();
    const again = voice.stop();
    emit({ type: "session.closed" });
    await Promise.all([stopped, again]);

    expect(sentOfType("session.close")).toHaveLength(1);
    expect(deleteCalls()).toHaveLength(1);
  });

  it("settles at once while idle", async () => {
    const { voice } = createVoice();

    await voice.stop();

    expect(calls).toEqual([]);
  });

  it("mutes the live microphone without ending the call", async () => {
    const { voice } = await startVoice();

    voice.toggleMute();

    expect(voice.getSnapshot()).toMatchObject({ muted: true, state: "live" });
    expect(audioTrack.enabled).toBe(false);

    voice.toggleMute();

    expect(audioTrack.enabled).toBe(true);
  });
});

describe("chat.voice page leave", () => {
  it.each([false, true])(
    "stops the microphone, closes the connection and releases with keepalive (persisted %s)",
    async (persisted) => {
      const { voice } = await startVoice();

      pageLeave(persisted);

      expect(audioTrack.stop).toHaveBeenCalled();
      expect(lastPeer.closed).toBe(true);
      expect(voice.getSnapshot().state).toBe("idle");
      const [release] = deleteCalls();
      expect(release.keepalive).toBe(true);
      expect(release.headers).toEqual({ Authorization: "Bearer app-access" });
    },
  );

  it("sends the stored token and no renewal, because renewal is a network call", async () => {
    await startVoice();
    storeSession(Date.now() + 1_000);

    pageLeave(false);
    await new Promise((resolve) => setTimeout(resolve));

    expect(deleteCalls()[0].headers).toEqual({ Authorization: "Bearer app-access" });
    expect(callsTo("POST", "/oauth/token")).toEqual([]);
  });

  it("drops the lines still pending", async () => {
    await startVoice();

    speak("thanks, bye");
    reply("Bye for now.");
    pageLeave(false);
    await new Promise((resolve) => setTimeout(resolve));

    expect(lineCalls()).toEqual([]);
  });

  it("closes the running turn's stream and drops the turns waiting behind it", async () => {
    await startVoice();

    await runningTurn("first", "item_1");
    speak("second");
    delegate("item_2");
    pageLeave(true);
    await new Promise((resolve) => setTimeout(resolve));

    expect(messageCalls()).toHaveLength(1);
    expect(messageCalls()[0].signal?.aborted).toBe(true);
  });

  it("stops listening once the call has ended", async () => {
    const { voice } = await startVoice();
    await runningTurn();
    const stopped = voice.stop();
    emit({ type: "session.closed" });
    await stopped;

    pageLeave(true);

    expect(deleteCalls()).toHaveLength(1);
    expect(messageCalls()[0].signal?.aborted).toBe(false);
  });

  it("releases a call Core answers after the page came back", async () => {
    let answerCore: (response: Response) => void = () => undefined;
    routes.push((call) =>
      call.method === "POST" && call.path === SESSIONS_PATH
        ? new Promise<Response>((resolve) => (answerCore = resolve))
        : undefined,
    );
    const { voice } = createVoice();

    const starting = voice.start({ sessionId: SESSION });
    await vi.waitFor(() => expect(callsTo("POST", SESSIONS_PATH)).toHaveLength(1));
    pageLeave(true);

    expect(audioTrack.stop).toHaveBeenCalled();
    expect(lastPeer.closed).toBe(true);
    expect(voice.getSnapshot().state).toBe("closing");

    answerCore(json(201, { liveSessionId: LIVE_SESSION, answerSdp: "answer-sdp", expiresAt: "", sessionId: SESSION }));
    const answer = await starting;

    expect(answer.error).toBeNull();
    expect(deleteCalls()).toHaveLength(1);
    expect(voice.getSnapshot().state).toBe("idle");
  });
});

describe("chat.voice sign-out", () => {
  it("releases the call with the token before the session is forgotten", async () => {
    const { client, voice } = await startVoice();

    const signedOut = client.auth.signOut();
    await vi.waitFor(() => expect(sentOfType("session.close")).toHaveLength(1));
    expect(storage.has(`oaiz.auth.${APP}`)).toBe(true);

    emit({ type: "session.closed" });
    await signedOut;

    expect(calls.map((call) => call.path).slice(-2)).toEqual([LIVE_SESSION_PATH, "/oauth/revoke"]);
    expect(deleteCalls()[0].headers).toMatchObject({ Authorization: "Bearer app-access" });
    expect(storage.has(`oaiz.auth.${APP}`)).toBe(false);
    expect(voice.getSnapshot().state).toBe("idle");
    expect(audioTrack.stop).toHaveBeenCalled();
  });

  it("closes the running turn's stream and drops the turns behind it", async () => {
    const { client } = await startVoice();

    await runningTurn("first", "item_1");
    speak("second");
    delegate("item_2");
    const signedOut = client.auth.signOut();
    await vi.waitFor(() => expect(sentOfType("session.close")).toHaveLength(1));
    emit({ type: "session.closed" });
    await signedOut;

    expect(messageCalls()).toHaveLength(1);
    expect(messageCalls()[0].signal?.aborted).toBe(true);
  });

  it("does not let a release that does not answer hold the sign-out", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    routes.push((call) => (call.method === "DELETE" ? new Promise<Response>(() => undefined) : undefined));
    const { client } = await startVoice();

    const signedOut = client.auth.signOut();
    await vi.advanceTimersByTimeAsync(5_000);
    await signedOut;

    expect(storage.has(`oaiz.auth.${APP}`)).toBe(false);
    expect(callsTo("POST", "/oauth/revoke")).toHaveLength(1);
  });

  it("asks nothing of a call that has already ended", async () => {
    const { client, voice } = await startVoice();
    await runningTurn();
    const stopped = voice.stop();
    emit({ type: "session.closed" });
    await stopped;

    await client.auth.signOut();

    expect(sentOfType("session.close")).toHaveLength(1);
    expect(deleteCalls()).toHaveLength(1);
    expect(messageCalls()[0].signal?.aborted).toBe(false);
  });
});

describe("chat.voice refused token", () => {
  it("ends the call when Core answers 401 to a line", async () => {
    routes.push((call) => (call.path === LINES_PATH ? refusal(401, "token-revoked") : undefined));
    const { voice } = await startVoice();

    speak("hello there");
    reply("Hi! What can I do for you today?");
    speak("more");

    await vi.waitFor(() => expect(sentOfType("session.close")).toHaveLength(1));
    expect(voice.getSnapshot().error?.code).toBe("token-revoked");
    emit({ type: "session.closed" });
    await vi.waitFor(() => expect(voice.getSnapshot().state).toBe("idle"));
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(lastPeer.closed).toBe(true);
  });

  it("ends the call and drops the waiting turns when Core answers 401 to a turn", async () => {
    let answerTurn: (response: Response) => void = () => undefined;
    routes.push((call) =>
      call.path === MESSAGES_PATH ? new Promise<Response>((resolve) => (answerTurn = resolve)) : undefined,
    );
    const { voice } = await startVoice();

    speak("first");
    delegate("item_1");
    speak("second");
    delegate("item_2");
    await vi.waitFor(() => expect(messageCalls()).toHaveLength(1));
    answerTurn(refusal(401, "token-revoked"));

    await vi.waitFor(() => expect(sentOfType("session.close")).toHaveLength(1));
    emit({ type: "session.closed" });
    await vi.waitFor(() => expect(voice.getSnapshot().state).toBe("idle"));

    expect(voice.getSnapshot().error?.code).toBe("token-revoked");
    expect(messageCalls()).toHaveLength(1);
    expect(audioTrack.stop).toHaveBeenCalled();
  });

  it("renews a token near expiry on a data channel event, with no timer", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    await startVoice();
    setTimeoutSpy.mockClear();
    storeSession(Date.now() + 30_000);

    reply("Hi");

    await vi.waitFor(() => expect(callsTo("POST", "/oauth/token")).toHaveLength(1));
    await vi.waitFor(() => expect(JSON.parse(storage.get(`oaiz.auth.${APP}`) ?? "{}").accessToken).toBe("renewed-access"));
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("releases with the renewed token", async () => {
    const { voice } = await startVoice();
    storeSession(Date.now() + 30_000);

    reply("Hi");
    await vi.waitFor(() => expect(JSON.parse(storage.get(`oaiz.auth.${APP}`) ?? "{}").accessToken).toBe("renewed-access"));
    const stopped = voice.stop();
    emit({ type: "session.closed" });
    await stopped;

    expect(deleteCalls()[0].headers).toMatchObject({ Authorization: "Bearer renewed-access" });
  });
});

describe("chat.voice exits", () => {
  it.each<[string, (context: { client: ReturnType<typeof appClient>; voice: ReturnType<typeof createVoice>["voice"] }) => Promise<unknown> | void]>([
    [
      "stop",
      async ({ voice }) => {
        const stopped = voice.stop();
        emit({ type: "session.closed" });
        await stopped;
      },
    ],
    ["the provider's close", () => emit({ type: "session.closed" })],
    ["a lost connection", () => lastPeer.drop("disconnected")],
    ["page leave", () => pageLeave(false)],
    [
      "sign-out",
      async ({ client }) => {
        const signedOut = client.auth.signOut();
        await vi.waitFor(() => expect(sentOfType("session.close")).toHaveLength(1));
        emit({ type: "session.closed" });
        await signedOut;
      },
    ],
  ])("%s stops every track and closes the connection", async (_name, exit) => {
    const tracks = [
      { stop: vi.fn(), enabled: true },
      { stop: vi.fn(), enabled: true },
    ];
    getUserMedia.mockResolvedValueOnce({ getTracks: () => tracks, getAudioTracks: () => tracks });
    const context = await startVoice();

    await exit(context);

    for (const track of tracks) expect(track.stop).toHaveBeenCalled();
    expect(lastPeer.closed).toBe(true);
    expect(context.voice.getSnapshot().state).toBe("idle");
  });
});
