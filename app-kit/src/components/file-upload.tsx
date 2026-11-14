import { useId, useRef, useState, type ReactNode } from 'react';
import {
  File,
  FileImage,
  FileText,
  FileVideo,
  Music,
  Download,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog';
import { Text } from './ui/text';

export type FileUploadLabels = {
  choose: string;
  drop: string;
  rejected: string;
  typeError: (name: string) => string;
  sizeError: (name: string, bytes: number) => string;
  countError: string;
  acceptedTypes: (accept: string) => string;
  maximumSize: (bytes: number) => string;
};
const uploadDefaults: FileUploadLabels = {
  choose: 'Choose files',
  drop: 'or drop files here',
  rejected: 'Some files were not added',
  typeError: (name) => `${name}: this file type is not accepted.`,
  sizeError: (name, bytes) =>
    `${name}: the maximum size is ${bytes.toLocaleString()} bytes.`,
  countError: 'Choose one file at a time.',
  acceptedTypes: (accept) => `Accepted types: ${accept}.`,
  maximumSize: (bytes) =>
    `Maximum size: ${bytes.toLocaleString()} bytes per file.`,
};
export type FileRejection = { file: File; message: string };
export type FileUploadProps = {
  label: ReactNode;
  description?: ReactNode;
  /** Native accept syntax: extensions, MIME types, or MIME wildcards, separated by commas. */
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  dropZone?: boolean;
  onFiles: (files: File[]) => void;
  onReject?: (files: FileRejection[]) => void;
  labels?: Partial<FileUploadLabels>;
  className?: string;
};
function accepts(file: File, accept: string) {
  return accept
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) =>
      entry.startsWith('.')
        ? file.name.toLowerCase().endsWith(entry)
        : entry.endsWith('/*')
          ? file.type.toLowerCase().startsWith(entry.slice(0, -1))
          : file.type.toLowerCase() === entry,
    );
}

/** Selection validation gives feedback; the upload endpoint still owns content and permission checks. */
export function FileUpload({
  label,
  description,
  accept,
  maxSize,
  multiple = true,
  disabled = false,
  dropZone = true,
  onFiles,
  onReject,
  labels: suppliedLabels,
  className,
}: FileUploadProps) {
  const labels = { ...uploadDefaults, ...suppliedLabels };
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<FileRejection[]>([]);
  const [dragging, setDragging] = useState(false);
  const guidance =
    description ??
    [
      accept ? labels.acceptedTypes(accept) : '',
      maxSize !== undefined ? labels.maximumSize(maxSize) : '',
    ]
      .filter(Boolean)
      .join(' ');
  function select(files: File[]) {
    if (disabled) return;
    const failures: FileRejection[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const message =
        !multiple && files.length > 1
          ? labels.countError
          : accept && !accepts(file, accept)
            ? labels.typeError(file.name)
            : maxSize !== undefined && file.size > maxSize
              ? labels.sizeError(file.name, maxSize)
              : undefined;
      if (message) failures.push({ file, message });
      else accepted.push(file);
    }
    setRejected(failures);
    if (failures.length > 0) onReject?.(failures);
    if (accepted.length > 0) onFiles(accepted);
  }
  return (
    <section
      aria-labelledby={`${id}-label`}
      className={cn('flex flex-col gap-inline', className)}
    >
      <p id={`${id}-label`} className="text-sm font-medium">
        {label}
      </p>
      {guidance && (
        <Text id={`${id}-hint`} size="sm" variant="muted">
          {guidance}
        </Text>
      )}
      <div
        className={cn(
          'flex flex-wrap items-center gap-inline rounded-md',
          dropZone && 'border border-dashed border-input p-inset',
          dragging && 'bg-accent',
        )}
        onDragOver={(event) => {
          if (dropZone) {
            event.preventDefault();
            event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
            if (!disabled) setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (!dropZone) return;
          event.preventDefault();
          setDragging(false);
          select(Array.from(event.dataTransfer.files));
        }}
      >
        <Input
          ref={input}
          id={id}
          type="file"
          className="sr-only h-px w-px border-0 p-0"
          tabIndex={-1}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          aria-labelledby={`${id}-label`}
          aria-describedby={guidance ? `${id}-hint` : undefined}
          onChange={(event) => {
            select(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-describedby={guidance ? `${id}-hint` : undefined}
          onClick={() => input.current?.click()}
        >
          {labels.choose}
        </Button>
        {dropZone && (
          <Text as="span" size="sm" variant="muted">
            {labels.drop}
          </Text>
        )}
      </div>
      {rejected.length > 0 && (
        <div role="alert" className="text-sm text-destructive-text">
          <p>{labels.rejected}</p>
          <ul className="list-inside list-disc">
            {rejected.map((item, index) => (
              <li key={`${item.file.name}-${index}`}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export type Attachment = {
  id: string;
  name: string;
  size?: number;
  href?: string;
  previewUrl?: string;
  mimeType?: string;
  status?: 'ready' | 'uploading' | 'error';
  /** 0–100; omit for an indeterminate upload. */
  progress?: number;
  error?: string;
};
export type AttachmentLabels = {
  list: string;
  uploading: string;
  failed: string;
  empty: string;
  cancelText: string;
  removeText: string;
  retryText: string;
  remove: (name: string) => string;
  cancel: (name: string) => string;
  retry: (name: string) => string;
  progress: (name: string) => string;
  preview: (name: string) => string;
  previewLoading: string;
  previewFailed: string;
  close: string;
  download: (name: string) => string;
  downloadText: string;
  downloading: string;
  downloadFailed: string;
};
const attachmentDefaults: AttachmentLabels = {
  list: 'Attachments',
  uploading: 'Uploading…',
  failed: 'Upload failed',
  empty: 'No attachments.',
  cancelText: 'Cancel',
  removeText: 'Remove',
  retryText: 'Retry',
  remove: (name) => `Remove ${name}`,
  cancel: (name) => `Cancel upload of ${name}`,
  retry: (name) => `Retry ${name}`,
  progress: (name) => `Upload progress for ${name}`,
  preview: (name) => `Preview ${name}`,
  previewLoading: 'Loading preview…',
  previewFailed: 'Preview unavailable.',
  close: 'Close',
  download: (name) => `Download ${name}`,
  downloadText: 'Download',
  downloading: 'Downloading…',
  downloadFailed: 'Download failed. Try again.',
};
export type AttachmentListProps = {
  attachments: readonly Attachment[];
  onRemove?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  /** The caller retrieves the content and starts its download. Reject to show a retryable error. */
  onDownload?: (id: string) => Promise<void>;
  /** Gallery previews contain the complete image; list previews are small thumbnails. */
  variant?: 'list' | 'gallery';
  labels?: Partial<AttachmentLabels>;
  locale?: string;
  className?: string;
};
function attachmentUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value, 'https://relative.invalid');
    return ['https:', 'http:', 'blob:'].includes(url.protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
export function AttachmentList({
  attachments,
  onRemove,
  onCancel,
  onRetry,
  onDownload,
  variant = 'list',
  labels: suppliedLabels,
  locale,
  className,
}: AttachmentListProps) {
  const labels = { ...attachmentDefaults, ...suppliedLabels };
  if (!attachments.length)
    return (
      <Text size="sm" variant="muted">
        {labels.empty}
      </Text>
    );
  return (
    <ul
      aria-label={labels.list}
      className={cn(
        variant === 'gallery'
          ? 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-stack'
          : 'flex flex-col gap-inline',
        className,
      )}
    >
      {attachments.map((file) => (
        <AttachmentItem
          key={file.id}
          file={file}
          labels={labels}
          locale={locale}
          variant={variant}
          onDownload={onDownload}
          onRemove={onRemove}
          onRetry={onRetry}
          onCancel={onCancel}
        />
      ))}
    </ul>
  );
}

function PreviewImage({
  src,
  name,
  labels,
  thumbnail = false,
}: {
  src: string;
  name: string;
  labels: AttachmentLabels;
  thumbnail?: boolean;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  return (
    <div
      className={cn(
        'relative flex min-w-0 items-center justify-center',
        thumbnail ? 'size-12 shrink-0' : 'aspect-video w-full',
      )}
    >
      {state === 'loading' && (
        <Skeleton
          aria-label={labels.previewLoading}
          className="absolute inset-0"
        />
      )}
      {state === 'error' && thumbnail ? (
        <FileImage
          aria-label={labels.previewFailed}
          className="size-6 text-muted-foreground"
        />
      ) : state === 'error' ? (
        <div className="flex flex-col items-center gap-inline p-inline">
          <Text size="sm" variant="muted" role="status">
            {labels.previewFailed}
          </Text>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setState('loading');
              setAttempt((value) => value + 1);
            }}
          >
            {labels.retryText}
          </Button>
        </div>
      ) : (
        <img
          key={attempt}
          src={src}
          alt={name}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          className={cn(
            'h-full w-full object-contain',
            state === 'loading' && 'invisible',
          )}
        />
      )}
    </div>
  );
}

function AttachmentItem({
  file,
  labels,
  locale,
  variant,
  onDownload,
  onRemove,
  onRetry,
  onCancel,
}: {
  file: Attachment;
  labels: AttachmentLabels;
  locale?: string;
  variant: 'list' | 'gallery';
} & Pick<
  AttachmentListProps,
  'onDownload' | 'onRemove' | 'onRetry' | 'onCancel'
>) {
  const href = attachmentUrl(file.href);
  const preview = attachmentUrl(file.previewUrl);
  const [downloadState, setDownloadState] = useState<
    'ready' | 'pending' | 'error'
  >('ready');
  const downloading = useRef(false);
  const gallery = variant === 'gallery';
  const Icon = file.mimeType?.startsWith('image/')
    ? FileImage
    : file.mimeType?.startsWith('video/')
      ? FileVideo
      : file.mimeType?.startsWith('audio/')
        ? Music
        : file.mimeType === 'application/pdf' ||
            file.mimeType?.startsWith('text/')
          ? FileText
          : File;
  async function download() {
    if (!onDownload || downloading.current) return;
    downloading.current = true;
    setDownloadState('pending');
    try {
      await onDownload(file.id);
      setDownloadState('ready');
    } catch {
      setDownloadState('error');
    } finally {
      downloading.current = false;
    }
  }
  return (
    <li
      className={cn(
        'flex min-w-0 gap-inline rounded-md border p-inset',
        gallery ? 'flex-col' : 'flex-wrap items-center',
      )}
    >
      {preview ? (
        <div className={cn(gallery ? 'w-full' : 'shrink-0')}>
          <PreviewImage
            key={preview}
            src={preview}
            name={file.name}
            labels={labels}
            thumbnail={!gallery}
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={labels.preview(file.name)}
                className="mt-1 h-auto min-h-9 max-w-full whitespace-normal break-words text-left"
              >
                {labels.preview(file.name)}
              </Button>
            </DialogTrigger>
            <DialogContent
              closeLabel={labels.close}
              aria-describedby={undefined}
              className="max-w-4xl"
            >
              <DialogTitle className="break-words pr-stack">
                {file.name}
              </DialogTitle>
              <PreviewImage src={preview} name={file.name} labels={labels} />
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <Icon
          aria-hidden="true"
          className={cn(
            'shrink-0 text-muted-foreground',
            gallery ? 'my-stack size-12 self-center' : 'size-6',
          )}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {href ? (
          <a
            href={href}
            className="break-words text-sm underline underline-offset-2"
          >
            {file.name}
          </a>
        ) : (
          <span className="break-words text-sm">{file.name}</span>
        )}
        {file.size !== undefined && (
          <Text as="span" size="xs" variant="muted">
            {new Intl.NumberFormat(locale, {
              style: 'unit',
              unit: 'byte',
              unitDisplay: 'short',
            }).format(file.size)}
          </Text>
        )}
        {file.status === 'uploading' && (
          <>
            <Text size="sm" role="status">
              {labels.uploading}
            </Text>
            <Progress
              aria-label={labels.progress(file.name)}
              max={100}
              value={
                file.progress === undefined || !Number.isFinite(file.progress)
                  ? undefined
                  : Math.min(100, Math.max(0, file.progress))
              }
              className="h-2 w-full"
            />
          </>
        )}
        {file.status === 'error' && (
          <Text size="sm" variant="destructive" role="alert">
            {file.error ?? labels.failed}
          </Text>
        )}
        {downloadState === 'error' && (
          <Text size="sm" variant="destructive" role="alert">
            {labels.downloadFailed}
          </Text>
        )}
        {downloadState === 'pending' && (
          <Text size="sm" role="status">
            {labels.downloading}
          </Text>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1">
        {file.status !== 'uploading' && onDownload && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloadState === 'pending'}
            aria-label={labels.download(file.name)}
            onClick={() => void download()}
          >
            <Download aria-hidden="true" />
            {downloadState === 'error' ? labels.retryText : labels.downloadText}
          </Button>
        )}
        {file.status !== 'uploading' && !onDownload && href && (
          <Button asChild variant="outline" size="sm">
            <a
              href={href}
              download={file.name}
              aria-label={labels.download(file.name)}
            >
              <Download aria-hidden="true" />
              {labels.downloadText}
            </a>
          </Button>
        )}
        {file.status === 'uploading' && onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={labels.cancel(file.name)}
            onClick={() => onCancel(file.id)}
          >
            {labels.cancelText}
          </Button>
        )}
        {file.status === 'error' && onRetry && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={labels.retry(file.name)}
            onClick={() => onRetry(file.id)}
          >
            {labels.retryText}
          </Button>
        )}
        {file.status !== 'uploading' && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={labels.remove(file.name)}
            onClick={() => onRemove(file.id)}
          >
            {labels.removeText}
          </Button>
        )}
      </div>
    </li>
  );
}
