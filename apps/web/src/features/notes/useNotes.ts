'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient, useApiDownload } from '@/lib/api-client';

import { noteDeletedSchema, noteListSchema, noteSchema, type NoteInput } from './note-model';

/**
 * EXAMPLE: notes. TanStack Query hooks over the API.
 *
 * Paths name no owner: the API serves the signed-in person's notes, from the
 * session token. Every change invalidates everything under the `notes` key,
 * so the list refreshes.
 */

const NOTES_KEY = ['notes'] as const;
const NOTES_PATH = '/api/v1/notes';
const STALE_MS = 30_000;

/** One page of the signed-in person's notes, newest first. */
export function useNotes(page: number) {
  const api = useApiClient();

  return useQuery({
    queryKey: [...NOTES_KEY, 'list', page],
    queryFn: async () => {
      const { items, pagination } = await api.getPage<unknown>(`${NOTES_PATH}?page=${page}`);
      return { items: noteListSchema.parse(items), pagination };
    },
    // The rows of the page being left stay up while the next page loads.
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

function useInvalidateNotes() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: NOTES_KEY });
}

export function useCreateNote() {
  const api = useApiClient();
  const invalidate = useInvalidateNotes();

  return useMutation({
    mutationFn: async (input: NoteInput) => noteSchema.parse(await api.post<unknown>(NOTES_PATH, input)),
    onSuccess: invalidate,
  });
}

export function useUpdateNote() {
  const api = useApiClient();
  const invalidate = useInvalidateNotes();

  return useMutation({
    mutationFn: async ({ noteId, input }: { readonly noteId: string; readonly input: NoteInput }) =>
      noteSchema.parse(await api.patch<unknown>(`${NOTES_PATH}/${noteId}`, input)),
    onSuccess: invalidate,
  });
}

export function useDeleteNote() {
  const api = useApiClient();
  const invalidate = useInvalidateNotes();

  return useMutation({
    mutationFn: async (noteId: string) => noteDeletedSchema.parse(await api.delete<unknown>(`${NOTES_PATH}/${noteId}`)),
    onSuccess: invalidate,
  });
}

/**
 * Fetches every note as a CSV file (`GET /notes/export`). The API answers
 * 403 `SUBSCRIPTION_REQUIRED` to anyone who is not subscribed, whatever the
 * screen showed them.
 */
export function useExportNotes() {
  const download = useApiDownload();

  return useMutation({ mutationFn: () => download(`${NOTES_PATH}/export`) });
}
