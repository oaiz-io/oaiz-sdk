/**
 * The operations the app client sends with fetch instead of the generated client: streams, whose
 * body the generated client buffers, and a keepalive request, which it cannot send.
 */
export const rawOperations = {
  createWorkflowRunStream: { method: "POST", path: "/ingest/workflows/{workflowUuid}/runs/stream" },
  streamActionExecutionEvents: { method: "GET", path: "/ingest/action/log/{uuid}/events" },
  createAppChatMessage: { method: "POST", path: "/internalagents/chat/apps/{appUuid}/messages" },
  createAppChatApproval: {
    method: "POST",
    path: "/internalagents/chat/apps/{appUuid}/sessions/{sessionId}/approvals/{toolCallId}",
  },
  deleteAppLiveVoiceSession: { method: "DELETE", path: "/internalagents/chat/apps/{appUuid}/voice/sessions/{id}" },
} as const;

type RawOperations = typeof rawOperations;
type PathParameters<Path> = Path extends `${string}{${infer Name}}${infer Rest}` ? Name | PathParameters<Rest> : never;

/** One request of a raw operation, with a value for each of its path parameters. */
export type RawRequest = {
  [Operation in keyof RawOperations]: {
    operation: Operation;
    params: Record<PathParameters<RawOperations[Operation]["path"]>, string>;
    query?: URLSearchParams;
  };
}[keyof RawOperations];

export interface RawRequestInit {
  headers: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  keepalive?: boolean;
}

/** Sends one raw request to the API at `url`, with a JSON body when `init.body` is set. */
export function sendRaw(url: string, request: RawRequest, init: RawRequestInit): Promise<Response> {
  const { method, path } = rawOperations[request.operation];
  const params: Record<string, string> = request.params;
  const search = request.query?.toString() ?? "";
  const headers = { ...init.headers };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(
    url.replace(/\/+$/, "") +
      path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(params[name])) +
      (search === "" ? "" : `?${search}`),
    {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      keepalive: init.keepalive,
    },
  );
}
