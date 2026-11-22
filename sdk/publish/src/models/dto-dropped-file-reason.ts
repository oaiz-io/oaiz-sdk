export const DtoDroppedFileReason = {
  ActiveContent: "active-content",
  DownloadFailed: "download-failed",
  FailedSecurityCheck: "failed-security-check",
  OverFileCountLimit: "over-file-count-limit",
  OverSizeLimit: "over-size-limit",
  OverTotalSizeLimit: "over-total-size-limit",
  UnsupportedType: "unsupported-type",
} as const;
export type DtoDroppedFileReason = (typeof DtoDroppedFileReason)[keyof typeof DtoDroppedFileReason];
