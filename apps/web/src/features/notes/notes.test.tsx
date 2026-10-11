import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw/http';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { BILLING_OFF, NOT_SUBSCRIBED, SUBSCRIBED, envelope, failure, page } from '@/__tests__/helpers/fixtures';
import { testLocation } from '@/__tests__/helpers/navigation';
import { renderWithQueryClient } from '@/__tests__/helpers/render';

import { noteInputSchema, type Note } from './note-model';
import { NotesView } from './NotesView';

/**
 * EXAMPLE: notes. The notes screen over a stand-in for the API (MSW), with
 * Clerk's session hook mocked.
 */

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

// ---------------------------------------------------------------------------
// What the API serves
// ---------------------------------------------------------------------------

const GROCERIES: Note = {
  id: 'note_groceries',
  title: 'Groceries',
  body: 'Oat milk, lemons, rye bread.',
  createdAt: '2026-06-01T09:00:00.000Z',
  updatedAt: '2026-06-02T09:00:00.000Z',
};

const IDEAS: Note = { ...GROCERIES, id: 'note_ideas', title: 'Ideas', body: '', updatedAt: '2026-05-20T09:00:00.000Z' };

const CSV = 'title,body,createdAt,updatedAt\nGroceries,"Oat milk, lemons, rye bread.",2026-06-01T09:00:00.000Z,2026-06-02T09:00:00.000Z\n';

let listRequests: URL[] = [];
let exportRequests = 0;
let writes: { method: string; path: string; body: unknown }[] = [];

const server = setupServer(
  http.get('*/api/v1/notes', ({ request }) => {
    listRequests.push(new URL(request.url));
    return HttpResponse.json(page([GROCERIES, IDEAS]));
  }),
  http.get('*/api/v1/billing', () => HttpResponse.json(envelope(NOT_SUBSCRIBED))),
  http.get('*/api/v1/notes/export', () => {
    exportRequests += 1;
    return new HttpResponse(CSV, { headers: { 'Content-Type': 'text/csv' } });
  }),
  http.post('*/api/v1/notes', async ({ request }) => {
    const body = await request.json();
    writes.push({ method: 'POST', path: new URL(request.url).pathname, body });
    return HttpResponse.json(envelope({ ...GROCERIES, id: 'note_new' }), { status: 201 });
  }),
  http.patch('*/api/v1/notes/:noteId', async ({ request }) => {
    writes.push({ method: 'PATCH', path: new URL(request.url).pathname, body: await request.json() });
    return HttpResponse.json(envelope(GROCERIES));
  }),
  http.delete('*/api/v1/notes/:noteId', ({ request }) => {
    writes.push({ method: 'DELETE', path: new URL(request.url).pathname, body: undefined });
    return HttpResponse.json(envelope({ deleted: true }));
  }),
);

function serveBilling(data: object) {
  server.use(http.get('*/api/v1/billing', () => HttpResponse.json(envelope(data))));
}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  listRequests = [];
  exportRequests = 0;
  writes = [];
});
afterAll(() => server.close());

/** Stands in for the browser saving a file: records what it was handed. */
const saveFile = vi.fn<(file: Blob, name: string) => void>();

const renderNotes = () => renderWithQueryClient(<NotesView saveFile={saveFile} />);
const table = () => screen.findByRole('table', { name: 'Notes' });
const exportButton = () => screen.getByRole('button', { name: 'Export CSV' });

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

describe('NotesView: the list', () => {
  it('lists each note with a line of its text and when it was updated', async () => {
    renderNotes();

    const groceries = await within(await table()).findByRole('row', { name: /Groceries/ });
    expect(groceries).toHaveTextContent('Oat milk, lemons, rye bread.');
    expect(groceries).toHaveTextContent('Jun 2, 2026');
    expect(screen.getByRole('row', { name: /Ideas/ })).toHaveTextContent('May 20, 2026');
  });

  it('offers a first note when there are none', async () => {
    server.use(http.get('*/api/v1/notes', () => HttpResponse.json(page([]))));
    renderNotes();

    expect(await screen.findByText('No notes yet')).toBeInTheDocument();
    // The header's button and the empty state's.
    expect(screen.getAllByRole('button', { name: 'New note' })).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    server.use(http.get('*/api/v1/notes', () => HttpResponse.json(failure(), { status: 500 })));
    renderNotes();

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load notes");
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('refuses a list that is not the shape the API promises', async () => {
    server.use(http.get('*/api/v1/notes', () => HttpResponse.json(page([{ id: 'note_x', title: 7 }]))));
    renderNotes();

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load notes");
  });

  it('asks the server for the page in the address, and for the next one from the footer', async () => {
    server.use(
      http.get('*/api/v1/notes', ({ request }) => {
        const url = new URL(request.url);
        listRequests.push(url);
        return HttpResponse.json(page([GROCERIES], 45, 20, Number(url.searchParams.get('page'))));
      }),
    );
    testLocation.set('/?page=2');
    const user = userEvent.setup();
    renderNotes();
    await within(await table()).findByRole('row', { name: /Groceries/ });

    expect(listRequests.at(-1)?.searchParams.get('page')).toBe('2');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(listRequests.at(-1)?.searchParams.get('page')).toBe('3'));
    expect(testLocation.searchParams.get('page')).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// Create, edit, delete
// ---------------------------------------------------------------------------

describe('NotesView: writing', () => {
  it('creates a note from the dialog and says so', async () => {
    const user = userEvent.setup();
    renderNotes();
    await table();

    await user.click(screen.getByRole('button', { name: 'New note' }));
    const dialog = await screen.findByRole('dialog', { name: 'New note' });
    await user.type(within(dialog).getByLabelText('Title'), '  Reading list ');
    await user.type(within(dialog).getByLabelText(/^Note/), 'Three books for the summer.');
    await user.click(within(dialog).getByRole('button', { name: 'Create note' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Reading list created'));
    expect(writes).toEqual([{ method: 'POST', path: '/api/v1/notes', body: { title: 'Reading list', body: 'Three books for the summer.' } }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('asks for a title before it sends anything', async () => {
    const user = userEvent.setup();
    renderNotes();
    await table();

    await user.click(screen.getByRole('button', { name: 'New note' }));
    const dialog = await screen.findByRole('dialog', { name: 'New note' });
    await user.click(within(dialog).getByRole('button', { name: 'Create note' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Give the note a title.');
    expect(within(dialog).getByLabelText('Title')).toBeInvalid();
    expect(writes).toEqual([]);
  });

  it('edits a note from its row menu, starting from what it holds', async () => {
    const user = userEvent.setup();
    renderNotes();
    await table();

    await user.click(await screen.findByRole('button', { name: 'Actions for Groceries' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit note' });
    const title = within(dialog).getByLabelText('Title');
    expect(title).toHaveValue('Groceries');
    await user.clear(title);
    await user.type(title, 'Shopping');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Note saved'));
    expect(writes).toEqual([
      { method: 'PATCH', path: '/api/v1/notes/note_groceries', body: { title: 'Shopping', body: 'Oat milk, lemons, rye bread.' } },
    ]);
  });

  it('keeps the dialog open and shows why when the API refuses to save', async () => {
    server.use(http.post('*/api/v1/notes', () => HttpResponse.json(failure('VALIDATION_ERROR', 'The title is too long'), { status: 400 })));
    const user = userEvent.setup();
    renderNotes();
    await table();

    await user.click(screen.getByRole('button', { name: 'New note' }));
    const dialog = await screen.findByRole('dialog', { name: 'New note' });
    await user.type(within(dialog).getByLabelText('Title'), 'Anything');
    await user.click(within(dialog).getByRole('button', { name: 'Create note' }));

    expect(await within(dialog).findByText('The title is too long')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('deletes a note only after it is confirmed', async () => {
    const user = userEvent.setup();
    renderNotes();
    await table();

    await user.click(await screen.findByRole('button', { name: 'Actions for Groceries' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Groceries?' });
    expect(writes).toEqual([]);

    await user.click(within(confirm).getByRole('button', { name: 'Delete note' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Groceries deleted'));
    expect(writes).toEqual([{ method: 'DELETE', path: '/api/v1/notes/note_groceries', body: undefined }]);
  });

  it('leaves the note alone when the confirmation is canceled', async () => {
    const user = userEvent.setup();
    renderNotes();
    await table();

    await user.click(await screen.findByRole('button', { name: 'Actions for Groceries' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Groceries?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(writes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The gated feature: export
// ---------------------------------------------------------------------------

describe('NotesView: export, which needs the plan', () => {
  it('downloads the CSV for a subscribed person', async () => {
    serveBilling(SUBSCRIBED);
    const user = userEvent.setup();
    renderNotes();
    await table();
    await waitFor(() => expect(exportButton()).toBeEnabled());
    expect(screen.queryByText(/Export comes with/)).not.toBeInTheDocument();

    await user.click(exportButton());

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    const [file, name] = saveFile.mock.calls[0] ?? [];
    expect(name).toBe('notes.csv');
    expect(await file?.text()).toBe(CSV);
  });

  it('shows it locked, with the way to Billing, to someone who is not subscribed', async () => {
    renderNotes();
    await table();

    const explanation = await screen.findByText(/Export comes with the Pro plan\./);
    expect(within(explanation).getByRole('link', { name: 'Go to Billing' })).toHaveAttribute('href', '/billing');
    expect(exportButton()).toBeDisabled();
    expect(exportRequests).toBe(0);
  });

  it('stays locked while billing is still loading, and when billing is switched off', async () => {
    serveBilling(BILLING_OFF);
    renderNotes();

    // Before billing has answered.
    expect(exportButton()).toBeDisabled();

    expect(await screen.findByText(/billing is switched off/)).toBeInTheDocument();
    expect(exportButton()).toBeDisabled();
  });

  it('says why when the API refuses the export after all', async () => {
    serveBilling(SUBSCRIBED);
    server.use(
      http.get('*/api/v1/notes/export', () => HttpResponse.json(failure('SUBSCRIPTION_REQUIRED', 'Export needs a subscription'), { status: 403 })),
    );
    const user = userEvent.setup();
    renderNotes();
    await table();
    await waitFor(() => expect(exportButton()).toBeEnabled());

    await user.click(exportButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Export needs a subscription'));
    expect(saveFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

describe('noteInputSchema', () => {
  it('trims the title and accepts an empty note', () => {
    expect(noteInputSchema.parse({ title: '  Hello ', body: '' })).toEqual({ title: 'Hello', body: '' });
  });

  it('refuses a blank title, and one or a note past the limits the API enforces', () => {
    expect(noteInputSchema.safeParse({ title: '   ', body: '' }).success).toBe(false);
    expect(noteInputSchema.safeParse({ title: 'a'.repeat(121), body: '' }).success).toBe(false);
    expect(noteInputSchema.safeParse({ title: 'a'.repeat(120), body: 'b'.repeat(5000) }).success).toBe(true);
    expect(noteInputSchema.safeParse({ title: 'ok', body: 'b'.repeat(5001) }).success).toBe(false);
  });
});
