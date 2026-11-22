import {
  ApiError,
  AuthConfigurationError,
  ResponseDecodeError,
} from "./errors";
import * as models from "./models";

export interface RequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  signal?: AbortSignal;
  followRedirects?: boolean;
}

export interface HookContext {
  operationId: string;
  method: string;
  pathTemplate: string;
  url: string;
  headers: Record<string, string>;
  requestMetadata: Record<string, string>;
  status?: number;
  responseHeaders?: Headers;
  opaqueRedirect?: boolean;
}

export type RequestHook = (
  context: HookContext,
  init: RequestInit,
) => void | Promise<void>;
export type ResponseHook = (
  context: HookContext,
  response: Response,
) => void | Promise<void>;
export type ErrorHook = (
  context: HookContext,
  error: unknown,
) => void | Promise<void>;

export interface ClientHooks {
  request?: RequestHook[];
  response?: ResponseHook[];
  error?: ErrorHook[];
}

export interface ClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  authMode?: "credentials" | "transport";
  apiKey?: string;
  apiKeys?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  hooks?: ClientHooks;
  bearerToken?: string;
}

interface RuntimeRequestContext {
  operationId: string;
  pathTemplate: string;
  idempotent?: boolean;
  idempotencyKeyHeader?: string;
  successStatuses?: readonly number[];
}

interface AuthRequirement {
  schemeId: string;
  kind: "apiKey" | "bearer" | "basic";
  name?: string;
}

/** First transport-error backoff step; doubles per attempt up to MAX_RETRY_DELAY_MS. */
const BASE_RETRY_DELAY_MS = 100;
/**
 * Ceiling for the TOTAL time spent waiting between retries, including any server-supplied
 * Retry-After. A per-wait cap alone still lets maxRetries x cap accumulate, so the budget is
 * spent down across the whole retry sequence and retrying stops once it is exhausted.
 */
const MAX_RETRY_DELAY_MS = 60000;

export class Client {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly authMode: "credentials" | "transport";
  private readonly apiKey?: string | undefined;
  private readonly apiKeys: Record<string, string>;
  private readonly timeoutMs?: number;
  private readonly maxRetries: number;
  private readonly retryStatuses: Set<number>;
  private readonly retryUnsafeMethods: boolean;
  private readonly hooks: Required<ClientHooks>;
  private readonly bearerToken?: string | undefined;
  private readonly basicAuth?: { username: string; password: string };

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    // The global fetch must stay bound to the global object. Stored unbound and then called as
    // `this.fetchFn(...)`, its receiver becomes the Client and browsers reject it with
    // "TypeError: Illegal invocation". A caller-supplied fetch is left alone — it may be a
    // method that depends on its own receiver.
    this.fetchFn = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.authMode = opts.authMode ?? "credentials";
    this.apiKey = opts.apiKey;
    this.apiKeys = opts.apiKeys ?? {};
    this.timeoutMs = opts.timeoutMs ?? 60000;
    this.maxRetries = opts.maxRetries ?? 0;
    this.retryStatuses = new Set<number>([408, 429]);
    this.retryUnsafeMethods = false;
    this.hooks = {
      request: opts.hooks?.request ?? [],
      response: opts.hooks?.response ?? [],
      error: opts.hooks?.error ?? [],
    };
    this.bearerToken = opts.bearerToken;
  }

  _apiKey(...names: string[]): string | undefined {
    for (const name of names) {
      const value = this.apiKeys[name];
      if (value !== undefined && value !== "") {
        return value;
      }
    }
    return this.apiKey === "" ? undefined : this.apiKey;
  }

  _bearerAuth(): string | undefined {
    if (this.bearerToken === undefined) {
      return undefined;
    }
    return `Bearer ${this.bearerToken}`;
  }

  _selectAuthAlternative(
    operationId: string,
    alternatives: readonly (readonly AuthRequirement[])[],
  ): Set<string> {
    if (alternatives.length === 0) {
      return new Set<string>();
    }
    if (this.authMode === "transport") {
      return new Set<string>();
    }
    for (const alternative of alternatives) {
      const satisfied = alternative.every((requirement) => {
        if (requirement.kind === "apiKey") {
          return (
            this._apiKey(requirement.schemeId, requirement.name ?? "") !==
            undefined
          );
        }
        if (requirement.kind === "bearer") {
          return this.bearerToken !== undefined;
        }
        return this.basicAuth !== undefined;
      });
      if (satisfied) {
        return new Set(alternative.map((requirement) => requirement.schemeId));
      }
    }
    throw new AuthConfigurationError(
      operationId,
      alternatives.map((alternative) =>
        alternative.map((requirement) => requirement.schemeId),
      ),
    );
  }

  async _decodeJson<T>(response: Response): Promise<T> {
    const rawBody = await response.text();
    const actualContentType = response.headers.get("content-type") ?? undefined;
    const mediaType =
      actualContentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    const errorInit = {
      headers: response.headers,
      requestId: response.headers.get("x-request-id") ?? undefined,
      rawBody,
      expectedContentType: "application/json",
      actualContentType,
    };
    if (rawBody.length === 0) {
      throw new ResponseDecodeError("empty_body", response.status, errorInit);
    }
    if (mediaType !== "application/json" && !mediaType.endsWith("+json")) {
      throw new ResponseDecodeError(
        "unexpected_content_type",
        response.status,
        errorInit,
      );
    }
    try {
      return JSON.parse(rawBody) as T;
    } catch (cause) {
      throw new ResponseDecodeError("invalid_json", response.status, {
        ...errorInit,
        cause,
      });
    }
  }

  async _decodeText(response: Response): Promise<string> {
    const bytes = new Uint8Array(await response.arrayBuffer());
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        bytes,
      );
    } catch (cause) {
      throw new ResponseDecodeError("invalid_text", response.status, {
        headers: response.headers,
        requestId: response.headers.get("x-request-id") ?? undefined,
        expectedContentType: "text/*",
        actualContentType: response.headers.get("content-type") ?? undefined,
        cause,
      });
    }
  }

  async _readErrorBody(
    response: Response,
  ): Promise<{ rawBody: string; jsonBody: unknown }> {
    const rawBody = await response.text();
    if (rawBody.length === 0) {
      return { rawBody, jsonBody: null };
    }
    const actualContentType =
      response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() ?? "";
    if (
      actualContentType !== "application/json" &&
      !actualContentType.endsWith("+json")
    ) {
      return { rawBody, jsonBody: null };
    }
    try {
      return { rawBody, jsonBody: JSON.parse(rawBody) as unknown };
    } catch {
      return { rawBody, jsonBody: null };
    }
  }

  private _encodeBody(body: unknown): BodyInit | undefined {
    if (body === undefined) {
      return undefined;
    }
    if (
      body instanceof URLSearchParams ||
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      typeof body === "string"
    ) {
      return body;
    }
    if (ArrayBuffer.isView(body)) {
      return new Blob([body as unknown as BlobPart]);
    }
    return JSON.stringify(body);
  }

  _formBody(body: unknown): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(
      body as Record<string, unknown>,
    )) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          params.append(key, String(item));
        }
      } else {
        params.set(key, String(value));
      }
    }
    return params;
  }

  _multipartBody(body: unknown): FormData {
    const form = new FormData();
    for (const [key, value] of Object.entries(
      body as Record<string, unknown>,
    )) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          this._appendMultipartValue(form, key, item);
        }
      } else {
        this._appendMultipartValue(form, key, value);
      }
    }
    return form;
  }

  private _appendMultipartValue(
    form: FormData,
    key: string,
    value: unknown,
  ): void {
    if (value === undefined || value === null) {
      return;
    }
    if (value instanceof Blob) {
      form.append(key, value);
    } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      form.append(key, new Blob([value as BlobPart]), key);
    } else {
      form.append(key, String(value));
    }
  }

  async _request(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: unknown,
    requestContext?: RuntimeRequestContext,
    options: RequestOptions = {},
  ): Promise<Response> {
    const context = requestContext ?? { operationId: "", pathTemplate: path };
    const url = `${this.baseUrl}${path}`;
    const requestMetadata = options.metadata ?? {};
    Object.assign(headers, options.headers ?? {});
    if (context.idempotent === true && options.idempotencyKey !== undefined) {
      headers[context.idempotencyKeyHeader ?? "Idempotency-Key"] =
        options.idempotencyKey;
    }
    const maxRetries = Math.max(0, options.maxRetries ?? this.maxRetries);
    const retryAttempts =
      this.retryUnsafeMethods ||
      context.idempotent === true ||
      this._retryableMethod(method)
        ? maxRetries
        : 0;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const bodyPayload = this._encodeBody(body);
    let lastError: unknown = undefined;
    let retryBudgetMs = MAX_RETRY_DELAY_MS;
    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      const controller =
        timeoutMs !== undefined && timeoutMs > 0
          ? new AbortController()
          : undefined;
      const timeoutId =
        controller === undefined
          ? undefined
          : setTimeout(() => controller.abort(), timeoutMs);
      const signals = [options.signal, controller?.signal].filter(
        (signal): signal is AbortSignal => signal !== undefined,
      );
      const init: RequestInit = {
        method,
        headers,
        body: bodyPayload ?? null,
        redirect: options.followRedirects === true ? "follow" : "manual",
        signal:
          signals.length > 1 ? AbortSignal.any(signals) : (signals[0] ?? null),
      };
      const hookContext: HookContext = {
        operationId: context.operationId,
        method,
        pathTemplate: context.pathTemplate,
        url,
        headers: { ...headers },
        requestMetadata,
      };
      try {
        for (const hook of this.hooks.request) {
          await hook(hookContext, init);
        }
      } catch (error) {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        for (const hook of this.hooks.error) {
          await hook(hookContext, error);
        }
        throw error;
      }
      let response: Response | undefined = undefined;
      try {
        response = await this.fetchFn(url, init);
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        lastError = error;
        if (attempt < retryAttempts && retryBudgetMs > 0) {
          // Back off before reconnecting: retrying a refused connection instantly just
          // multiplies load on a service that is already restarting.
          const delayMs = Math.min(
            this._backoffDelayMs(attempt),
            retryBudgetMs,
          );
          retryBudgetMs -= delayMs;
          await this._waitBeforeRetry(delayMs, options.signal, hookContext);
          continue;
        }
        for (const hook of this.hooks.error) {
          await hook(hookContext, error);
        }
        throw error;
      }
      if (response === undefined) {
        throw new Error("request failed without response");
      }
      const opaqueRedirect =
        response.type === "opaqueredirect" &&
        options.followRedirects !== true &&
        (context.successStatuses ?? []).some(
          (status) => status >= 300 && status < 400,
        );
      hookContext.status = response.status;
      hookContext.responseHeaders = response.headers;
      hookContext.opaqueRedirect = opaqueRedirect;
      try {
        for (const hook of this.hooks.response) {
          await hook(hookContext, response);
        }
      } catch (error) {
        for (const hook of this.hooks.error) {
          await hook(hookContext, error);
        }
        throw error;
      }
      if (
        this._shouldRetryStatus(response.status) &&
        attempt < retryAttempts &&
        retryBudgetMs > 0
      ) {
        // Release the connection before retrying. An unread body keeps its socket checked out
        // of the pool until GC, so a retry storm can exhaust the pool.
        await this._discardBody(response);
        const delayMs = Math.min(
          this._retryDelayMs(response, attempt),
          retryBudgetMs,
        );
        retryBudgetMs -= delayMs;
        await this._waitBeforeRetry(delayMs, options.signal, hookContext);
        continue;
      }
      if (
        (response.status < 200 || response.status >= 300) &&
        !(context.successStatuses ?? []).includes(response.status) &&
        !opaqueRedirect
      ) {
        const error = new ApiError(response.status, {
          headers: response.headers,
          requestId: response.headers.get("x-request-id") ?? undefined,
        });
        for (const hook of this.hooks.error) {
          await hook(hookContext, error);
        }
      }
      return response;
    }
    throw lastError ?? new Error("request failed without response");
  }

  private _retryableMethod(method: string): boolean {
    return (
      method === "GET" ||
      method === "HEAD" ||
      method === "OPTIONS" ||
      method === "PUT" ||
      method === "DELETE"
    );
  }

  private _shouldRetryStatus(status: number): boolean {
    return this.retryStatuses.has(status) || status >= 500;
  }

  private async _discardBody(response: Response): Promise<void> {
    try {
      await response.body?.cancel();
    } catch {
      // Already consumed or errored; the connection is being torn down either way.
    }
  }

  private _retryDelayMs(response: Response, attempt: number): number {
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter !== null) {
      const seconds = Number.parseInt(retryAfter, 10);
      if (Number.isFinite(seconds) && seconds > 0) {
        // A server may ask for an arbitrarily long wait. Honour it only up to the ceiling,
        // so a hostile or misconfigured origin cannot park the caller for hours.
        return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
      }
    }
    return this._backoffDelayMs(attempt);
  }

  private _backoffDelayMs(attempt: number): number {
    return Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
  }

  private async _waitBeforeRetry(
    ms: number,
    signal: AbortSignal | undefined,
    hookContext: HookContext,
  ): Promise<void> {
    try {
      await this._sleep(ms, signal);
    } catch (error) {
      // Every other failure path notifies the error hooks; an abort landing mid-wait must not
      // be the one exception, or callers lose the event entirely.
      for (const hook of this.hooks.error) {
        await hook(hookContext, error);
      }
      throw error;
    }
  }

  private async _sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) {
      return;
    }
    if (signal?.aborted === true) {
      throw signal.reason ?? new Error("request aborted");
    }
    // The wait must observe cancellation: without this an aborted or timed-out request still
    // blocks for the full retry delay before anyone notices.
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal?.reason ?? new Error("request aborted"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  get action(): ActionApi {
    return new ActionApi(this);
  }

  get appChat(): AppChatApi {
    return new AppChatApi(this);
  }

  get event(): EventApi {
    return new EventApi(this);
  }

  get llm(): LlmApi {
    return new LlmApi(this);
  }

  get storage(): StorageApi {
    return new StorageApi(this);
  }

  get tools(): ToolsApi {
    return new ToolsApi(this);
  }

  get workflow(): WorkflowApi {
    return new WorkflowApi(this);
  }
}

export class ActionApi {
  constructor(private readonly client: Client) {}

  listActionExecutionLogs(
    ...args: Parameters<Client["listActionExecutionLogs"]>
  ): ReturnType<Client["listActionExecutionLogs"]> {
    return this.client.listActionExecutionLogs(...args);
  }

  streamActionExecutionEvents(
    ...args: Parameters<Client["streamActionExecutionEvents"]>
  ): ReturnType<Client["streamActionExecutionEvents"]> {
    return this.client.streamActionExecutionEvents(...args);
  }
}

export class AppChatApi {
  constructor(private readonly client: Client) {}

  createAppChatMessage(
    ...args: Parameters<Client["createAppChatMessage"]>
  ): ReturnType<Client["createAppChatMessage"]> {
    return this.client.createAppChatMessage(...args);
  }

  listAppChatSessions(
    ...args: Parameters<Client["listAppChatSessions"]>
  ): ReturnType<Client["listAppChatSessions"]> {
    return this.client.listAppChatSessions(...args);
  }

  getAppChatSession(
    ...args: Parameters<Client["getAppChatSession"]>
  ): ReturnType<Client["getAppChatSession"]> {
    return this.client.getAppChatSession(...args);
  }

  createAppChatApproval(
    ...args: Parameters<Client["createAppChatApproval"]>
  ): ReturnType<Client["createAppChatApproval"]> {
    return this.client.createAppChatApproval(...args);
  }

  createAppVoiceLine(
    ...args: Parameters<Client["createAppVoiceLine"]>
  ): ReturnType<Client["createAppVoiceLine"]> {
    return this.client.createAppVoiceLine(...args);
  }

  createAppLiveVoiceSession(
    ...args: Parameters<Client["createAppLiveVoiceSession"]>
  ): ReturnType<Client["createAppLiveVoiceSession"]> {
    return this.client.createAppLiveVoiceSession(...args);
  }

  deleteAppLiveVoiceSession(
    ...args: Parameters<Client["deleteAppLiveVoiceSession"]>
  ): ReturnType<Client["deleteAppLiveVoiceSession"]> {
    return this.client.deleteAppLiveVoiceSession(...args);
  }
}

export class EventApi {
  constructor(private readonly client: Client) {}

  publishEvent(
    ...args: Parameters<Client["publishEvent"]>
  ): ReturnType<Client["publishEvent"]> {
    return this.client.publishEvent(...args);
  }
}

export class LlmApi {
  constructor(private readonly client: Client) {}

  createEmbeddings(
    ...args: Parameters<Client["createEmbeddings"]>
  ): ReturnType<Client["createEmbeddings"]> {
    return this.client.createEmbeddings(...args);
  }

  createLlmCall(
    ...args: Parameters<Client["createLlmCall"]>
  ): ReturnType<Client["createLlmCall"]> {
    return this.client.createLlmCall(...args);
  }
}

export class StorageApi {
  constructor(private readonly client: Client) {}

  callStorageDatabaseFunction(
    ...args: Parameters<Client["callStorageDatabaseFunction"]>
  ): ReturnType<Client["callStorageDatabaseFunction"]> {
    return this.client.callStorageDatabaseFunction(...args);
  }

  deleteStorageDatabaseRows(
    ...args: Parameters<Client["deleteStorageDatabaseRows"]>
  ): ReturnType<Client["deleteStorageDatabaseRows"]> {
    return this.client.deleteStorageDatabaseRows(...args);
  }

  insertStorageDatabaseRows(
    ...args: Parameters<Client["insertStorageDatabaseRows"]>
  ): ReturnType<Client["insertStorageDatabaseRows"]> {
    return this.client.insertStorageDatabaseRows(...args);
  }

  selectStorageDatabaseRows(
    ...args: Parameters<Client["selectStorageDatabaseRows"]>
  ): ReturnType<Client["selectStorageDatabaseRows"]> {
    return this.client.selectStorageDatabaseRows(...args);
  }

  updateStorageDatabaseRows(
    ...args: Parameters<Client["updateStorageDatabaseRows"]>
  ): ReturnType<Client["updateStorageDatabaseRows"]> {
    return this.client.updateStorageDatabaseRows(...args);
  }

  upsertStorageDatabaseRows(
    ...args: Parameters<Client["upsertStorageDatabaseRows"]>
  ): ReturnType<Client["upsertStorageDatabaseRows"]> {
    return this.client.upsertStorageDatabaseRows(...args);
  }
}

export class ToolsApi {
  constructor(private readonly client: Client) {}

  listTools(
    ...args: Parameters<Client["listTools"]>
  ): ReturnType<Client["listTools"]> {
    return this.client.listTools(...args);
  }

  getNativeTools(
    ...args: Parameters<Client["getNativeTools"]>
  ): ReturnType<Client["getNativeTools"]> {
    return this.client.getNativeTools(...args);
  }

  runTool(
    ...args: Parameters<Client["runTool"]>
  ): ReturnType<Client["runTool"]> {
    return this.client.runTool(...args);
  }
}

export class WorkflowApi {
  constructor(private readonly client: Client) {}

  getWorkflowRun(
    ...args: Parameters<Client["getWorkflowRun"]>
  ): ReturnType<Client["getWorkflowRun"]> {
    return this.client.getWorkflowRun(...args);
  }

  createWorkflowRunStream(
    ...args: Parameters<Client["createWorkflowRunStream"]>
  ): ReturnType<Client["createWorkflowRunStream"]> {
    return this.client.createWorkflowRunStream(...args);
  }
}

export type ListActionExecutionLogsParams = {
  cursor?: string;
  endTime?: string;
  excludeTestRuns?: boolean;
  includeRunSummaries?: boolean;
  jobUuid?: string;
  pageSize?: number;
  startTime?: string;
  statuses?: ("awaiting-approval" | "awaiting-delay" | "awaiting-event" | "budget-exceeded" | "executing" | "failure" | "not-executed" | "rejected" | "success" | "timeout")[];
  testRunUuid?: string;
  triggeringEventUuid?: string;
  updatedAfter?: string;
  workflowUuid?: string;
  workflowVersionId?: string;
};

export type StreamActionExecutionEventsParams = {
  lastEventId?: string;
  after?: string;
  publishEvents?: boolean;
};

export type PublishEventBody =
  | {
      contentType: "application/json";
      value: models.DtoEventInputInput;
    }
  | {
      contentType: "multipart/form-data";
      value: { event: string; files?: Array<Blob | ArrayBuffer | Uint8Array> };
    };

export type GetWorkflowRunParams = {
  publishEvents?: boolean;
};

export type ListToolsParams = {
  integrationUuid?: string;
  job?: "agent" | "code";
  nativeOnly?: boolean;
  query?: string;
};

export type GetNativeToolsParams = {
  surface?: "actions" | "app" | "chat";
};

export type ListAppChatSessionsParams = {
  cursor?: string;
  pageSize?: number;
};
import { listActionExecutionLogs as operation0_0 } from "./apis/api_action";
import { listActionExecutionLogsPages as operation0_1 } from "./apis/api_action";
import { iterateListActionExecutionLogs as operation0_2 } from "./apis/api_action";
import { streamActionExecutionEvents as operation0_3 } from "./apis/api_action";
import { createAppChatMessage as operation1_0 } from "./apis/api_app_chat";
import { listAppChatSessions as operation1_1 } from "./apis/api_app_chat";
import { getAppChatSession as operation1_2 } from "./apis/api_app_chat";
import { createAppChatApproval as operation1_3 } from "./apis/api_app_chat";
import { createAppVoiceLine as operation1_4 } from "./apis/api_app_chat";
import { createAppLiveVoiceSession as operation1_5 } from "./apis/api_app_chat";
import { deleteAppLiveVoiceSession as operation1_6 } from "./apis/api_app_chat";
import { publishEvent as operation2_0 } from "./apis/api_event";
import { createEmbeddings as operation3_0 } from "./apis/api_llm";
import { createLlmCall as operation3_1 } from "./apis/api_llm";
import { callStorageDatabaseFunction as operation4_0 } from "./apis/api_storage";
import { deleteStorageDatabaseRows as operation4_1 } from "./apis/api_storage";
import { insertStorageDatabaseRows as operation4_2 } from "./apis/api_storage";
import { selectStorageDatabaseRows as operation4_3 } from "./apis/api_storage";
import { updateStorageDatabaseRows as operation4_4 } from "./apis/api_storage";
import { upsertStorageDatabaseRows as operation4_5 } from "./apis/api_storage";
import { listTools as operation5_0 } from "./apis/api_tools";
import { getNativeTools as operation5_1 } from "./apis/api_tools";
import { runTool as operation5_2 } from "./apis/api_tools";
import { getWorkflowRun as operation6_0 } from "./apis/api_workflow";
import { createWorkflowRunStream as operation6_1 } from "./apis/api_workflow";

export interface Client {
  listActionExecutionLogs: typeof operation0_0;
  listActionExecutionLogsPages: typeof operation0_1;
  iterateListActionExecutionLogs: typeof operation0_2;
  streamActionExecutionEvents: typeof operation0_3;
  createAppChatMessage: typeof operation1_0;
  listAppChatSessions: typeof operation1_1;
  getAppChatSession: typeof operation1_2;
  createAppChatApproval: typeof operation1_3;
  createAppVoiceLine: typeof operation1_4;
  createAppLiveVoiceSession: typeof operation1_5;
  deleteAppLiveVoiceSession: typeof operation1_6;
  publishEvent: typeof operation2_0;
  createEmbeddings: typeof operation3_0;
  createLlmCall: typeof operation3_1;
  callStorageDatabaseFunction: typeof operation4_0;
  deleteStorageDatabaseRows: typeof operation4_1;
  insertStorageDatabaseRows: typeof operation4_2;
  selectStorageDatabaseRows: typeof operation4_3;
  updateStorageDatabaseRows: typeof operation4_4;
  upsertStorageDatabaseRows: typeof operation4_5;
  listTools: typeof operation5_0;
  getNativeTools: typeof operation5_1;
  runTool: typeof operation5_2;
  getWorkflowRun: typeof operation6_0;
  createWorkflowRunStream: typeof operation6_1;
}

Client.prototype.listActionExecutionLogs = operation0_0;
Client.prototype.listActionExecutionLogsPages = operation0_1;
Client.prototype.iterateListActionExecutionLogs = operation0_2;
Client.prototype.streamActionExecutionEvents = operation0_3;
Client.prototype.createAppChatMessage = operation1_0;
Client.prototype.listAppChatSessions = operation1_1;
Client.prototype.getAppChatSession = operation1_2;
Client.prototype.createAppChatApproval = operation1_3;
Client.prototype.createAppVoiceLine = operation1_4;
Client.prototype.createAppLiveVoiceSession = operation1_5;
Client.prototype.deleteAppLiveVoiceSession = operation1_6;
Client.prototype.publishEvent = operation2_0;
Client.prototype.createEmbeddings = operation3_0;
Client.prototype.createLlmCall = operation3_1;
Client.prototype.callStorageDatabaseFunction = operation4_0;
Client.prototype.deleteStorageDatabaseRows = operation4_1;
Client.prototype.insertStorageDatabaseRows = operation4_2;
Client.prototype.selectStorageDatabaseRows = operation4_3;
Client.prototype.updateStorageDatabaseRows = operation4_4;
Client.prototype.upsertStorageDatabaseRows = operation4_5;
Client.prototype.listTools = operation5_0;
Client.prototype.getNativeTools = operation5_1;
Client.prototype.runTool = operation5_2;
Client.prototype.getWorkflowRun = operation6_0;
Client.prototype.createWorkflowRunStream = operation6_1;
