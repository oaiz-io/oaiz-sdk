export interface PublishEventFormRequest {
  event: string;
  files?: Array<Blob | ArrayBuffer | Uint8Array>;
}
