import { describe, expectTypeOf, it } from "vitest";

import type { ListAppChatSessionsParams } from "../../../client";
import type {
  DtoAppChatApprovalRequest,
  DtoAppChatMessageRequest,
  DtoAppChatPendingApproval,
  DtoAppChatSessionDetail,
  DtoChatSessionListOutput,
  DtoChatTimelineEvent,
} from "../../../models";
import {
  createClient,
  OaizChat,
  OaizVoice,
  type OaizChatDecision,
  type OaizChatMessage,
  type OaizChatTools,
  type OaizError,
  type OaizResponse,
  type OaizVoiceSnapshot,
  type OaizVoiceStarted,
} from "../../index";

describe("chat", () => {
  it("exists on an app client on every database and not on a key client", () => {
    const app = createClient({ url: "https://api.oaiz.test", app: "app-1", database: "db-1" });
    expectTypeOf(app.chat).toEqualTypeOf<OaizChat>();
    expectTypeOf(app.database("db-2").chat).toEqualTypeOf<OaizChat>();

    const server = createClient({ url: "https://api.oaiz.test", key: "oai_server_key", database: "db-1" });
    // @ts-expect-error a key client has no member to chat as
    expectTypeOf(server.chat);
  });

  it("streams chat events and wraps sessions and tools in the response envelope", () => {
    const { chat } = createClient({ url: "https://api.oaiz.test", app: "app-1", database: "db-1" });
    const message: OaizChatMessage = { content: "Hi", systemPrompt: "Be brief." };

    expectTypeOf(chat.send(message)).toEqualTypeOf<AsyncIterable<OaizResponse<DtoChatTimelineEvent>>>();
    expectTypeOf(chat.send(message, { signal: new AbortController().signal })).toEqualTypeOf<AsyncIterable<OaizResponse<DtoChatTimelineEvent>>>();
    expectTypeOf(chat.sessions.list).parameter(0).toEqualTypeOf<ListAppChatSessionsParams | undefined>();
    expectTypeOf(chat.sessions.list()).toEqualTypeOf<Promise<OaizResponse<DtoChatSessionListOutput>>>();
    expectTypeOf(chat.sessions.get("session-1")).toEqualTypeOf<Promise<OaizResponse<DtoAppChatSessionDetail>>>();
    expectTypeOf<DtoAppChatSessionDetail["pendingApproval"]>().toEqualTypeOf<DtoAppChatPendingApproval | undefined>();
    expectTypeOf(chat.tools()).toEqualTypeOf<Promise<OaizResponse<OaizChatTools>>>();
  });

  it("requires the author's system prompt and the content, and takes only named tools", () => {
    const { chat } = createClient({ url: "https://api.oaiz.test", app: "app-1", database: "db-1" });
    // @ts-expect-error the system prompt is required
    chat.send({ content: "Hi" });
    // @ts-expect-error the system prompt is a string
    chat.send({ content: "Hi", systemPrompt: undefined });
    // @ts-expect-error the content is required
    chat.send({ systemPrompt: "Be brief." });
    // @ts-expect-error a native tool is an OAIZ tool name
    chat.send({ content: "Hi", systemPrompt: "Be brief.", nativeTools: [{ name: "not_a_tool" }] });
    // @ts-expect-error a native tool is an object that names it
    chat.send({ content: "Hi", systemPrompt: "Be brief.", nativeTools: ["storage_query"] });
    // @ts-expect-error an integration tool names its connection and action
    chat.send({ content: "Hi", systemPrompt: "Be brief.", integrationTools: [{ integrationUuid: "connection-id" }] });
    chat.send({
      content: "Hi",
      systemPrompt: "Be brief.",
      nativeTools: [{ name: "storage_query" }, { name: "storage_execute", requireApproval: true }],
      integrationTools: [{ integrationUuid: "connection-id", actionType: "send_message", requireApproval: true }],
    });
    // @ts-expect-error approval is a field of each tool
    chat.send({ content: "Hi", systemPrompt: "Be brief.", toolApprovalModes: { storage_query: "require_approval" } });
  });

  it("sends a request body the route accepts", () => {
    expectTypeOf<OaizChatMessage & { clientMessageId: string }>().toMatchTypeOf<DtoAppChatMessageRequest>();
    // The route refuses unknown fields, so a message field the request no longer has fails every send.
    // The voice fields belong to `chat.voice`.
    expectTypeOf<keyof OaizChatMessage>().toEqualTypeOf<Exclude<keyof DtoAppChatMessageRequest, "type" | "voiceDelegationId">>();
  });

  it("opens a voice conversation whose turns name their own tools", () => {
    const { chat } = createClient({ url: "https://api.oaiz.test", app: "app-1", database: "db-1" });
    const voice = chat.voice({ turn: () => ({ systemPrompt: "Be brief.", nativeTools: [{ name: "storage_query" }] }) });

    expectTypeOf(voice).toEqualTypeOf<OaizVoice>();
    expectTypeOf(voice.start({ sessionId: "session-1" })).toEqualTypeOf<Promise<OaizResponse<OaizVoiceStarted>>>();
    expectTypeOf(voice.getSnapshot()).toEqualTypeOf<OaizVoiceSnapshot>();
    expectTypeOf(voice.getSnapshot().error).toEqualTypeOf<OaizError | null>();
    expectTypeOf(voice.send("Hi")).toEqualTypeOf<{ error: OaizError | null }>();
    expectTypeOf(voice.stop()).toEqualTypeOf<Promise<void>>();
    expectTypeOf(voice.stopTurn).toEqualTypeOf<() => void>();
    expectTypeOf(voice.stopAllTurns).toEqualTypeOf<() => void>();

    // @ts-expect-error a turn needs the author's system prompt
    chat.voice({ turn: () => ({ nativeTools: [{ name: "storage_query" }] }) });
    // @ts-expect-error a native tool is an OAIZ tool name
    chat.voice({ turn: () => ({ systemPrompt: "Be brief.", nativeTools: [{ name: "not_a_tool" }] }) });
    // @ts-expect-error a voice conversation needs its turns
    chat.voice({ instructions: "Notes." });
  });

  it("decides a pending call with the message's turn settings", () => {
    const { chat } = createClient({ url: "https://api.oaiz.test", app: "app-1", database: "db-1" });
    const decision: OaizChatDecision = { sessionId: "session-1", toolCallId: "call-1", systemPrompt: "Be brief." };

    expectTypeOf(chat.approve(decision)).toEqualTypeOf<AsyncIterable<OaizResponse<DtoChatTimelineEvent>>>();
    expectTypeOf(chat.decline(decision, { signal: new AbortController().signal })).toEqualTypeOf<AsyncIterable<OaizResponse<DtoChatTimelineEvent>>>();
    // @ts-expect-error a decision names its chat
    chat.approve({ toolCallId: "call-1", systemPrompt: "Be brief." });
    // @ts-expect-error a decision names its call
    chat.approve({ sessionId: "session-1", systemPrompt: "Be brief." });
    // @ts-expect-error a decision resends the system prompt
    chat.decline({ sessionId: "session-1", toolCallId: "call-1" });
    // @ts-expect-error a decision carries no message content
    chat.approve({ ...decision, content: "Hi" });
  });

  it("sends a decision body the route accepts", () => {
    type Settings = Omit<OaizChatDecision, "sessionId" | "toolCallId">;
    expectTypeOf<Settings & { approved: boolean }>().toMatchTypeOf<DtoAppChatApprovalRequest>();
    // The route refuses unknown fields, so a setting the request no longer has fails every decision.
    expectTypeOf<keyof Settings | "approved">().toEqualTypeOf<keyof DtoAppChatApprovalRequest>();
  });
});
