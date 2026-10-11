'use client';

import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageDescription,
  PageHeader,
  PageSection,
  PageTitle,
  PageWrapper,
  type DataTableColumn,
  type RowAction,
} from '@app/ui';
import { Download, Lock, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ErrorState } from '@/components/ui/ErrorState';
import { BILLING_PATH } from '@/lib/billing/billing-model';
import { useBilling, useIsSubscribed } from '@/lib/hooks/useBilling';
import { useUrlParams } from '@/lib/hooks/useUrlParam';

import { EXPORT_FILE_NAME, formatNoteDate, type Note } from './note-model';
import { NoteFormDialog } from './NoteFormDialog';
import { useDeleteNote, useExportNotes, useNotes } from './useNotes';

const PAGE_PARAM = 'page';
const FIRST_PAGE = 1;

/** The page the URL asks for. Anything missing or unreadable is the first. */
function readPage(params: URLSearchParams): number {
  const page = Number(params.get(PAGE_PARAM));
  return Number.isInteger(page) && page >= FIRST_PAGE ? page : FIRST_PAGE;
}

/** What the screen says before there is a note. */
const FIRST_RUN = {
  title: 'No notes yet',
  description: 'A note is a title and some text, kept for you alone. Write the first one.',
} as const;

/** The dialog the screen has open, if any. One at a time. */
type OpenDialog =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly note: Note }
  | { readonly kind: 'delete'; readonly note: Note };

/** Hands a file to the browser to save, as a click on a download link does. */
function saveToDisk(file: Blob, name: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export interface NotesViewProps {
  /** How an exported file reaches the person. Injected in tests. */
  readonly saveFile?: (file: Blob, name: string) => void;
}

/**
 * EXAMPLE: notes. The pattern for a list screen: the standard table, paged by
 * the server; loading, empty and error states; create and edit in a dialog;
 * delete behind a confirmation.
 *
 * It is also the example of a feature that needs the plan: "Export CSV" works
 * for a subscribed person and is shown locked, with the way to Billing, to
 * everyone else. That is presentation only. The API refuses the export to
 * anyone who is not subscribed, whatever this screen shows.
 */
export function NotesView({ saveFile = saveToDisk }: NotesViewProps = {}) {
  // The page lives in the URL, so the list survives a reload and can be bookmarked.
  const [params, setParams] = useUrlParams();
  const page = readPage(params);
  const setPage = (next: number) => setParams({ [PAGE_PARAM]: next === FIRST_PAGE ? null : String(next) });

  const [dialog, setDialog] = useState<OpenDialog>();
  const notes = useNotes(page);
  // Read for the plan's name in the line that explains the lock.
  const billing = useBilling();
  const deleteNote = useDeleteNote();
  const exportNotes = useExportNotes();

  const rows = notes.data?.items ?? [];
  const isFirstRun = page === FIRST_PAGE && notes.data !== undefined && rows.length === 0;
  // The gate: locked until billing says the person is subscribed, so the export never flashes open.
  const canExport = useIsSubscribed();

  const columns = useMemo<DataTableColumn<Note, never>[]>(
    () => [
      {
        id: 'title',
        header: 'Note',
        className: 'w-full min-w-[12rem] whitespace-normal',
        cell: (note) => (
          <div className="min-w-0">
            <p className="font-medium leading-snug">{note.title}</p>
            {note.body && <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[0.8125rem] leading-snug">{note.body}</p>}
            {/* On a narrow screen the date column is hidden, so it is said here. */}
            <p className="text-muted-foreground mt-0.5 text-[0.8125rem] leading-snug sm:hidden">Updated {formatNoteDate(note.updatedAt)}</p>
          </div>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Updated',
        className: 'hidden whitespace-nowrap tabular-nums sm:table-cell',
        cell: (note) => formatNoteDate(note.updatedAt),
      },
    ],
    [],
  );

  const rowActions = (note: Note): RowAction[] => [
    { label: 'Edit', icon: Pencil, onSelect: () => setDialog({ kind: 'edit', note }) },
    { label: 'Delete', icon: Trash2, destructive: true, onSelect: () => setDialog({ kind: 'delete', note }) },
  ];

  const confirmDelete = async () => {
    if (dialog?.kind !== 'delete') return;
    const { note } = dialog;
    try {
      await deleteNote.mutateAsync(note.id);
      toast.success(`${note.title} deleted`);
      setDialog(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The note could not be deleted.');
    }
  };

  const runExport = () => {
    exportNotes.mutate(undefined, {
      onSuccess: (file) => saveFile(file, EXPORT_FILE_NAME),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'The notes could not be exported.');
      },
    });
  };

  const newNoteButton = (
    <Button onClick={() => setDialog({ kind: 'create' })}>
      <Plus aria-hidden />
      New note
    </Button>
  );

  return (
    <PageWrapper>
      <PageSection variant="header">
        <PageHeader>
          <div>
            <PageTitle>Notes</PageTitle>
            <PageDescription className="mt-1.5 text-sm">Your notes, newest first. Only you can see them.</PageDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={runExport} disabled={!canExport || exportNotes.isPending}>
              {canExport ? <Download aria-hidden /> : <Lock aria-hidden />}
              Export CSV
            </Button>
            {newNoteButton}
          </div>
        </PageHeader>
        {billing.data && !canExport && (
          <p className="text-muted-foreground mt-2 flex items-start gap-2 text-sm sm:justify-end">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span>
              {billing.data.billingEnabled
                ? `Export comes with the ${billing.data.plan.name} plan.`
                : 'Export comes with a subscription, and billing is switched off.'}{' '}
              <Link href={BILLING_PATH} className="text-primary font-medium underline-offset-4 hover:underline">
                Go to Billing
              </Link>
            </span>
          </p>
        )}
      </PageSection>

      <PageSection variant="content">
        {notes.error && !notes.data ? (
          <ErrorState what="notes" onRetry={() => void notes.refetch()} />
        ) : isFirstRun ? (
          <EmptyState icon={NotebookPen} title={FIRST_RUN.title} description={FIRST_RUN.description}>
            {newNoteButton}
          </EmptyState>
        ) : (
          <DataTable
            label="Notes"
            itemLabel="notes"
            columns={columns}
            rows={rows}
            rowId={(note) => note.id}
            rowLabel={(note) => note.title}
            rowActions={rowActions}
            pagination={notes.data?.pagination}
            onPageChange={setPage}
            isLoading={notes.isLoading}
            isRefreshing={notes.isFetching && !notes.isLoading}
            empty={
              // Only reachable past the first page: the last note on this page was deleted.
              <EmptyState compact icon={NotebookPen} title="No notes on this page" description="The notes that were here have been deleted.">
                <Button variant="outline" onClick={() => setPage(FIRST_PAGE)}>
                  Back to the first page
                </Button>
              </EmptyState>
            }
          />
        )}
      </PageSection>

      <NoteFormDialog
        open={dialog?.kind === 'create' || dialog?.kind === 'edit'}
        onOpenChange={(open) => !open && setDialog(undefined)}
        note={dialog?.kind === 'edit' ? dialog.note : undefined}
      />

      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={dialog?.kind === 'delete' ? `Delete ${dialog.note.title}?` : 'Delete note?'}
        description="The note is removed for good."
        confirmLabel="Delete note"
        isLoading={deleteNote.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </PageWrapper>
  );
}
