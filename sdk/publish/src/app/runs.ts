import type { Client, ListActionExecutionLogsParams } from "../client";
import type {
  DtoExecuteProgressEvent,
  DtoWorkflowRun,
  DtoWorkflowRunRequest,
  QueryListActionExecutionLogsOutput,
} from "../models";
import type { RawRequest } from "./raw-request";
import { failure, failureFrom, type OaizResponse } from "./response";
import { readSseStream, type OpenStream } from "./sse-stream";

/** Options of a run stream. */
export interface OaizRunStreamOptions {
  /** Ends the stream; the run goes on. */
  signal?: AbortSignal;
}

export interface OaizRunGetOptions {
  /** The `publishEvents` the run was started with. Defaults to true. */
  publishEvents?: boolean;
}

/** Where `follow` starts. The cursor carries `publishEvents` when present. */
export interface OaizRunFollowOptions extends OaizRunStreamOptions, OaizRunGetOptions {
  /** The `after` of the last frame you read; omit it to read from the start. */
  after?: string;
}

/** Start a workflow using one of `event`, `sourceEventUuid` or `sourceExecutionUuid`. */
export interface OaizRunStart extends OaizRunStreamOptions, Omit<DtoWorkflowRunRequest, "jobUuid" | "runUuid"> {
  /** The workflow ID. */
  workflow: string;
  /** The job ID, if selecting a job instead of matching the event to an entry job. */
  job?: string;
  /** A caller-chosen UUIDv7 for the run. */
  runId?: string;
}

/** One progress frame of a run. Save `after`: `follow` resumes after it. */
export interface OaizRunProgress {
  event: DtoExecuteProgressEvent;
  after?: string;
}

/** A single stream of a run's progress. Breaking iteration closes the stream, not the run. */
export interface OaizRun extends AsyncIterable<OaizResponse<OaizRunProgress>> {
  /** Reads the final run snapshot. Call instead of iterating, or after reading progress. */
  result(): Promise<OaizResponse<DtoWorkflowRun>>;
}

/** Starts, follows and reads workflow runs: with `app`, only of workflows shared with the app. */
export class OaizRuns {
  /** @internal */
  constructor(
    private readonly client: Client,
    private readonly open: OpenStream,
  ) {}

  /**
   * Starts one run of a workflow and yields its progress until it ends or waits. The first frame
   * of a started run is `root_start` with its `actionExecutionLogUuid`. Set `runId` to a UUIDv7
   * you keep to follow the run if the stream breaks before that frame.
   */
  start({ workflow, job, runId, signal, ...input }: OaizRunStart): OaizRun {
    const body: DtoWorkflowRunRequest = { ...input, jobUuid: job, runUuid: runId };
    return this.stream({ operation: "createWorkflowRunStream", params: { workflowUuid: workflow } }, body, signal, runId);
  }

  /** Follows a run until it ends or waits. Following never starts the run again. */
  follow(runId: string, options?: OaizRunFollowOptions): OaizRun {
    const query = new URLSearchParams();
    if (options?.after !== undefined) query.set("after", options.after);
    if (options?.publishEvents !== undefined) query.set("publishEvents", String(options.publishEvents));
    const raw: RawRequest = { operation: "streamActionExecutionEvents", params: { uuid: runId }, query };
    return this.stream(raw, undefined, options?.signal, runId);
  }

  /** Reads one run with its status, jobs and events. Never throws. */
  async get(runId: string, options?: OaizRunGetOptions): Promise<OaizResponse<DtoWorkflowRun>> {
    try {
      const data = await this.client.getWorkflowRun(runId, options);
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

  private stream(
    request: RawRequest,
    body: unknown,
    signal: AbortSignal | undefined,
    knownRunId: string | undefined,
  ): OaizRun {
    const frames = readSseStream<DtoExecuteProgressEvent>(
      this.open,
      request,
      body,
      signal,
      "execute_progress",
      isLastFrame,
    );

    let runId: string | undefined;
    let outcome: OaizResponse<DtoWorkflowRun> | undefined;
    let reading: Promise<OaizResponse<DtoWorkflowRun>> | undefined;
    const progress = readProgress();
    return { [Symbol.asyncIterator]: () => progress, result: () => reading ??= readResult() };

    async function* readProgress(): AsyncGenerator<OaizResponse<OaizRunProgress>> {
      for await (const frame of frames) {
        if (frame.error !== null) {
          outcome = frame;
          yield frame;
          continue;
        }
        const { data: event, id: after } = frame.data;
        if (event.type === "root_start") runId = event.actionExecutionLogUuid;
        if (isLastFrame(event)) {
          if (event.run) outcome = { ...frame, data: event.run };
          else if (event.message || event.slug) {
            outcome = failure(frame.status, {
              message: event.message ?? "The run did not return a result.",
              code: event.slug ?? "",
              hints: [],
            });
          }
        }
        yield { ...frame, data: { event, after } };
      }
    }

    async function readResult(): Promise<OaizResponse<DtoWorkflowRun>> {
      for await (const _ of progress) {}
      const response = outcome ?? failure(0, { message: "The run stream ended before returning a result.", code: "", hints: [] });
      const id = runId ?? (response.status === 0 ? knownRunId : undefined);
      if (response.error === null || id === undefined) return response;
      return { ...response, error: { ...response.error, message: `${response.error.message} (run ${id})` } };
    }
  }
}

function isLastFrame(event: DtoExecuteProgressEvent): boolean {
  return event.type === "terminal" || event.type === "waiting";
}
