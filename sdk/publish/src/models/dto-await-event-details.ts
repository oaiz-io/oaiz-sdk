import type * as models from "./index";

export interface DtoAwaitEventDetails {
  awaitedEvents: models.DtoAwaitEventDetailsAwaitedEvent[] | null;
  conversationUuid?: string;
  deadlineAt?: string;
  deadlineBehavior?: models.DtoAwaitEventDeadlineBehavior;
  expired: boolean;
  resolutionReason?: string;
  resolvedAt?: string;
  resolvingEvent?: models.DtoEventMinimalMetadata;
  startedAt: string;
  status: string;
  uuid: string;
}
