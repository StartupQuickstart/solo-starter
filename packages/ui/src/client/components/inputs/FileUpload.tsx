'use client';

import { FileIcon, Upload, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';

import { Button } from '@/client/components/ui/button';
import { cn } from '@/shared/lib/utils';

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

/** "1.5 MB", "320 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1).replace(/\.0$/, '')} MB`;
  return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
}

/** Whether a file matches an `accept` list of MIME types (`image/png`, `image/*`) and extensions (`.csv`). */
function isAccepted(file: Pick<File, 'name' | 'type'>, accept: readonly string[]): boolean {
  if (accept.length === 0) return true;
  return accept.some((rule) => {
    if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule.toLowerCase());
    if (rule.endsWith('/*')) return file.type.startsWith(rule.slice(0, -1));
    return file.type === rule;
  });
}

export interface FileUploadProps {
  /** The files chosen so far. The component is controlled: it keeps none itself. */
  readonly files: readonly File[];
  readonly onChange: (files: File[]) => void;
  /** MIME types and extensions to accept. Everything when omitted. */
  readonly accept?: readonly string[];
  /** The largest file accepted, in bytes. */
  readonly maxSizeBytes?: number | undefined;
  /** Allow more than one file. @default false */
  readonly multiple?: boolean;
  /** The line under "Choose a file", such as "PNG or JPEG, up to 5 MB". */
  readonly hint?: string | undefined;
  readonly disabled?: boolean;
  readonly id?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * Chooses files, by the file dialog or by dropping them on the area. It
 * checks type and size before accepting and says which files it refused and
 * why. It does not upload: the screen decides what to do with the files.
 */
export function FileUpload({
  files,
  onChange,
  accept = [],
  maxSizeBytes,
  multiple = false,
  hint,
  disabled = false,
  id,
  className,
  ...ariaProps
}: FileUploadProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<readonly string[]>([]);

  const add = (incoming: readonly File[]) => {
    const refused: string[] = [];
    const accepted = incoming.filter((file) => {
      if (!isAccepted(file, accept)) {
        refused.push(`${file.name} is not a type that can be uploaded here.`);
        return false;
      }
      if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
        refused.push(`${file.name} is over ${formatFileSize(maxSizeBytes)}.`);
        return false;
      }
      return true;
    });
    setProblems(refused);
    if (accepted.length === 0) return;
    onChange(multiple ? [...files, ...accepted] : accepted.slice(0, 1));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) add(Array.from(event.dataTransfer.files));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors',
          dragging && 'border-primary bg-primary/5',
          disabled && 'opacity-50',
        )}
      >
        <Upload aria-hidden className="text-muted-foreground size-6" />
        <p className="text-sm">
          <Button type="button" variant="link" className="h-auto p-0" disabled={disabled} onClick={() => inputRef.current?.click()}>
            {multiple ? 'Choose files' : 'Choose a file'}
          </Button>{' '}
          <span className="text-muted-foreground">or drop {multiple ? 'them' : 'it'} here</span>
        </p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label={multiple ? 'Files to upload' : 'File to upload'}
          accept={accept.join(',') || undefined}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            // Allow choosing the same file again after removing it.
            event.target.value = '';
          }}
          {...ariaProps}
        />
      </div>

      {problems.length > 0 && (
        <ul role="alert" className="text-destructive space-y-0.5 text-xs font-medium">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul aria-label="Chosen files" className="divide-y rounded-lg border">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatFileSize(file.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, position) => position !== index))}
              >
                <X aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
