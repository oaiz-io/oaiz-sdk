export const DtoChatSubmissionStatus = {
  Accepted: "accepted",
  Applied: "applied",
  Rejected: "rejected",
} as const;
export type DtoChatSubmissionStatus = (typeof DtoChatSubmissionStatus)[keyof typeof DtoChatSubmissionStatus];
