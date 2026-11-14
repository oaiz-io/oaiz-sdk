export interface DtoToolUsageMetrics {
  errorCode?: string;
  latencyMs: number;
  provider: string;
  requestId?: string;
  requestSize: number;
  responseSize: number;
  success: boolean;
  toolName: string;
  toolType: string;
  unitType?: string;
  units?: number;
}
