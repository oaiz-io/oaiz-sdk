export interface DtoAppChatPendingApproval {
  args?: Record<string, unknown>;
  displayName?: string;
  expired?: boolean;
  expiresAt?: string;
  toolCallId: string;
  toolName: string;
}
