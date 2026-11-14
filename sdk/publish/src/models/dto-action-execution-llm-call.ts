export interface DtoActionExecutionLLMCall {
  cachedInputTokens?: number;
  createdAt: string;
  inputTokens: number;
  latencyMs: number;
  model: string;
  outputTokens: number;
  provider: string;
  requestId?: string;
  sequence: number;
  thinkingTokens?: number;
}
