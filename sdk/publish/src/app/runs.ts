import type { Client, ListActionExecutionLogsParams } from "../client";
import type {
  DtoActionExecutionLog,
  DtoExecuteProgressEvent,
  DtoJobExecuteRequest,
  QueryListActionExecutionLogsOutput,
} from "../models";
import type { RawRequest } from "./raw-request";
import { failureFrom, type OaizResponse } from "./response";
import { readSseStream, type OpenStream } from "./sse-stream";

/** Options of a run stream. */
export interface OaizRunStreamOptions {
  /** Ends the stream; the run goes on. */
  signal?: AbortSignal;
}

/** Where `follow` starts. */
export interface OaizRunFollowOptions extends OaizRunStreamOptions {
  /** The `after` of the last frame you read; omit it to read from the start. */
  after?: string;
  /** The `publishEvents` the run was started with, when you follow without `after`. Defaults to true. */
  publishEvents?: boolean;
}

/** One progress frame of a run. Save `after`: `follow` resumes after it. */
export interface OaizRunProgress {
  event: DtoExecuteProgressEvent;
  after?: string;
}

/** Starts, follows and reads workflow runs: with `app`, only of workflows shared with the app. */
export class OaizRuns {
  /** @internal */
  constructor(
    private readonly client: Client,
    private readonly open: OpenStream,
  ) {}

  /**
   * Starts the job with the ID `jobUuid` and yields its progress until the run ends or waits. The
   * first frame is `root_start` with the run's `actionExecutionLogUuid`. Set `actionExecutionUuid`
   * to a UUIDv7 you keep, to follow the run again if the stream breaks before that frame.
   */
  start(
    jobUuid: string,
    request: DtoJobExecuteRequest,
    options?: OaizRunStreamOptions,
  ): AsyncIterable<OaizResponse<OaizRunProgress>> {
    return this.stream({ operation: "executeJobStream", params: { jobUuid } }, request, options?.signal);
  }

  /** Follows a run until it ends or waits. Following never starts the run again. */
  follow(
    actionExecutionUuid: string,
    options?: OaizRunFollowOptions,
  ): AsyncIterable<OaizResponse<OaizRunProgress>> {
    const query = new URLSearchParams();
    if (options?.after !== undefined) query.set("after", options.after);
    if (options?.publishEvents !== undefined) query.set("publishEvents", String(options.publishEvents));
    const raw: RawRequest = { operation: "streamActionExecutionEvents", params: { uuid: actionExecutionUuid }, query };
    return this.stream(raw, undefined, options?.signal);
  }

  /** Reads one run with its logs and results. Never throws. */
  async get(actionExecutionUuid: string): Promise<OaizResponse<DtoActionExecutionLog>> {
    try {
      const data = await this.client.getActionExecutionLogByUuid(actionExecutionUuid);
      return { data, error: null, count: null, status: 200 };
    } catch (error) {
      return failureFrom(error);
    }
  }

  /** Lists one page of runs; `triggeringEventUuid` finds the runs a published event started. Never throws. */
  async list(
    params?: ListActionExecutionLogsParams,
  ): Promise<OaizResponse<QueryListActionExecutionLogsOutput>> {
    try {
      const data = await this.client.listActionExecutionLogs(params);
      return { data, error: null, count: null, status: 200 };
    } catch (error) {
      return failureFrom(error);
    }
  }

  private async *stream(
    request: RawRequest,
    body: unknown,
    signal: AbortSignal | undefined,
  ): AsyncGenerator<OaizResponse<OaizRunProgress>> {
    const frames = readSseStream<DtoExecuteProgressEvent>(
      this.open,
      request,
      body,
      signal,
      "execute_progress",
      (event) => event.type === "terminal" || event.type === "waiting",
    );
    for await (const frame of frames) {
      yield frame.error === null ? { ...frame, data: { event: frame.data.data, after: frame.data.id } } : frame;
    }
  }
}
