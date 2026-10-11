import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTable, type DataTableColumn } from './data/DataTable';
import type { SortState } from './data/SortableTableHead';
import { Banner } from './feedback/Banner';
import { EmptyState } from './feedback/EmptyState';
import { Spinner } from './feedback/Spinner';
import { Field } from './forms/Field';
import { Combobox } from './inputs/Combobox';
import { CopyButton } from './inputs/CopyButton';
import { DatePicker } from './inputs/DatePicker';
import { FileUpload, formatFileSize } from './inputs/FileUpload';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

afterEach(() => {
  vi.useRealTimers();
});

describe('Field', () => {
  it('labels its control and describes it with the help line', () => {
    render(
      <Field label="Note name" help="Shown in lists.">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Note name');
    expect(input).toHaveAccessibleDescription('Shown in lists.');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid and announces the error', () => {
    render(
      <Field label="Note name" help="Shown in lists." error="Give the note a name.">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Note name');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Shown in lists. Give the note a name.');
    expect(screen.getByRole('alert')).toHaveTextContent('Give the note a name.');
  });

  it('says when a field is optional', () => {
    render(
      <Field label="Description" optional>
        <Input />
      </Field>,
    );

    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('labels and describes a Select through its trigger, which is the part people focus', () => {
    render(
      <Field label="Status" help="Where the work stands." error="Choose a status.">
        <Select value="active" onValueChange={() => undefined}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
          </SelectContent>
        </Select>
      </Field>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Status' });
    expect(screen.getByLabelText('Status')).toBe(trigger);
    expect(trigger).toHaveAccessibleDescription('Where the work stands. Choose a status.');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
  });

  it('leaves a Select outside a Field with the name it was given', () => {
    render(
      <Select value="active" onValueChange={() => undefined}>
        <SelectTrigger aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Filter by status' });
    expect(trigger).not.toHaveAttribute('aria-invalid');
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });
});

describe('Spinner', () => {
  it('is a status with a name', () => {
    render(<Spinner label="Saving" />);

    expect(screen.getByRole('status')).toHaveTextContent('Saving');
  });
});

describe('Banner', () => {
  it('announces warnings and errors at once, and information politely', () => {
    const { rerender } = render(<Banner tone="error" title="Payment failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Payment failed');

    rerender(<Banner tone="info" title="Read-only" />);
    expect(screen.getByRole('status')).toHaveTextContent('Read-only');
  });

  it('shows its detail and action, and can be dismissed', async () => {
    const onDismiss = vi.fn();
    render(
      <Banner tone="warning" title="Trial ends soon" action={<button type="button">Upgrade</button>} onDismiss={onDismiss}>
        Three days left.
      </Banner>,
    );

    expect(screen.getByText('Three days left.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has no dismiss button unless it can be dismissed', () => {
    render(<Banner title="Read-only" />);

    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('says what will live here and offers the first action', () => {
    render(
      <EmptyState icon={Inbox} title="No notes yet" description="Notes you create appear here.">
        <button type="button">New note</button>
      </EmptyState>,
    );

    expect(screen.getByText('No notes yet')).toBeInTheDocument();
    expect(screen.getByText('Notes you create appear here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument();
  });
});

describe('DatePicker', () => {
  function Harness({ initial = null as string | null, onValue = vi.fn() }) {
    const [value, setValue] = useState<string | null>(initial);
    return (
      <Field label="Due date">
        <DatePicker
          value={value}
          onChange={(next) => {
            setValue(next);
            onValue(next);
          }}
        />
      </Field>
    );
  }

  it('reports the chosen day as YYYY-MM-DD', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2027-03-01' } });

    expect(onValue).toHaveBeenLastCalledWith('2027-03-01');
    expect(screen.getByLabelText('Due date')).toHaveValue('2027-03-01');
  });

  it('clears to null, and offers no clear button when there is nothing to clear', async () => {
    const onValue = vi.fn();
    render(<Harness initial="2027-03-01" onValue={onValue} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear date' }));

    expect(onValue).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole('button', { name: 'Clear date' })).not.toBeInTheDocument();
  });
});

describe('CopyButton', () => {
  it('copies the value and confirms it to sighted people and to screen readers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<CopyButton value="prj_123" label="Copy note id" showLabel writeText={writeText} />);

    await userEvent.setup().click(screen.getByRole('button', { name: /Copy note id/ }));

    expect(writeText).toHaveBeenCalledWith('prj_123');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument();
  });

  it('goes back to offering a copy after a moment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<CopyButton value="x" showLabel writeText={vi.fn().mockResolvedValue(undefined)} />);

    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2000);

    await waitFor(() => expect(screen.queryByText('Copied')).not.toBeInTheDocument());
  });

  it('does not claim success when the browser refuses', async () => {
    render(<CopyButton value="x" showLabel writeText={vi.fn().mockRejectedValue(new Error('denied'))} />);

    await userEvent.setup().click(screen.getByRole('button', { name: /Copy/ }));

    expect(screen.queryByText('Copied')).not.toBeInTheDocument();
  });

  it('is named by its label when it shows only an icon', () => {
    render(<CopyButton value="x" label="Copy API key" writeText={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Copy API key' })).toBeInTheDocument();
  });
});

describe('Combobox', () => {
  const PEOPLE = [
    { value: 'u1', label: 'Ada Lovelace', description: 'ada@example.com' },
    { value: 'u2', label: 'Grace Hopper', description: 'grace@example.com' },
    { value: 'u3', label: 'Alan Turing', description: 'alan@example.com' },
  ];

  function Harness({ onValue = vi.fn(), clearLabel }: { onValue?: (value: string | null) => void; clearLabel?: string }) {
    const [value, setValue] = useState<string | null>(null);
    return (
      <Field label="Owner">
        <Combobox
          options={PEOPLE}
          value={value}
          placeholder="Choose a person"
          clearLabel={clearLabel}
          onChange={(next) => {
            setValue(next);
            onValue(next);
          }}
        />
      </Field>
    );
  }

  it('is a labelled combobox that opens a list of options', async () => {
    render(<Harness />);
    const box = screen.getByRole('combobox', { name: 'Owner' });
    expect(box).toHaveAttribute('aria-expanded', 'false');

    await userEvent.setup().click(box);

    expect(box).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
  });

  it('filters as you type, by name or by the second line', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole('combobox'), 'grace@');

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Grace Hoppergrace@example.com']);
  });

  it('chooses with the keyboard alone: arrows move, Enter chooses', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    const box = screen.getByRole('combobox');
    box.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');

    expect(onValue).toHaveBeenCalledWith('u3');
    expect(box).toHaveValue('Alan Turing');
    expect(box).toHaveAttribute('aria-expanded', 'false');
  });

  it('chooses with the mouse', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Grace Hopper/ }));

    expect(onValue).toHaveBeenCalledWith('u2');
  });

  it('closes on Escape without choosing', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    await user.type(screen.getByRole('combobox'), 'ada{Escape}');

    expect(onValue).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    render(<Harness />);

    await userEvent.setup().type(screen.getByRole('combobox'), 'zzz');

    expect(screen.getByText('No matches.')).toBeInTheDocument();
  });

  it('offers a row that clears the choice when asked to', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} clearLabel="No owner" />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'No owner' }));

    expect(onValue).toHaveBeenCalledWith(null);
  });
});

describe('FileUpload', () => {
  const png = (name: string, bytes = 1024) => new File([new Uint8Array(bytes)], name, { type: 'image/png' });

  function Harness({ onFiles = vi.fn() }: { onFiles?: (files: File[]) => void }) {
    const [files, setFiles] = useState<File[]>([]);
    return (
      <FileUpload
        files={files}
        accept={['image/png', '.csv']}
        maxSizeBytes={2048}
        multiple
        hint="PNG or CSV, up to 2 KB"
        onChange={(next) => {
          setFiles(next);
          onFiles(next);
        }}
      />
    );
  }

  it('lists the files chosen, with their sizes', async () => {
    render(<Harness />);

    await userEvent.setup().upload(screen.getByLabelText('Files to upload'), [png('logo.png'), png('icon.png', 2048)]);

    const list = screen.getByRole('list', { name: 'Chosen files' });
    expect(within(list).getByText('logo.png')).toBeInTheDocument();
    expect(within(list).getByText('2 KB')).toBeInTheDocument();
  });

  it('refuses a file of the wrong type or over the size limit, and says which and why', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} />);
    const text = new File(['x'], 'notes.txt', { type: 'text/plain' });

    // Dropped files skip the dialog's own type filter, so this is the check that matters.
    fireEvent.drop(screen.getByText(/or drop them here/).closest('div')!, {
      dataTransfer: { files: [text, png('huge.png', 4096)] },
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('notes.txt is not a type that can be uploaded here.');
    expect(alert).toHaveTextContent('huge.png is over 2 KB.');
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('accepts by extension as well as by type', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} />);

    fireEvent.drop(screen.getByText(/or drop them here/).closest('div')!, {
      dataTransfer: { files: [new File(['a,b'], 'data.CSV', { type: '' })] },
    });

    expect(onFiles).toHaveBeenCalledTimes(1);
  });

  it('removes a file by name', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.upload(screen.getByLabelText('Files to upload'), [png('logo.png'), png('icon.png')]);

    await user.click(screen.getByRole('button', { name: 'Remove logo.png' }));

    expect(screen.queryByText('logo.png')).not.toBeInTheDocument();
    expect(screen.getByText('icon.png')).toBeInTheDocument();
  });

  it('formats sizes', () => {
    expect(formatFileSize(320 * 1024)).toBe('320 KB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
  });
});

describe('DataTable', () => {
  interface Note {
    id: string;
    name: string;
    status: string;
  }
  type SortKey = 'name' | 'status';

  const ROWS: Note[] = [
    { id: 'p1', name: 'Alpha', status: 'Active' },
    { id: 'p2', name: 'Bravo', status: 'Planned' },
  ];
  const COLUMNS: DataTableColumn<Note, SortKey>[] = [
    { id: 'name', header: 'Name', sortKey: 'name', cell: (row) => row.name },
    { id: 'status', header: 'Status', cell: (row) => row.status },
  ];
  const base = { label: 'Notes', columns: COLUMNS, rowId: (row: Note) => row.id, rowLabel: (row: Note) => row.name };

  it('is a named table with a row per record', () => {
    render(<DataTable {...base} rows={ROWS} />);

    const table = screen.getByRole('table', { name: 'Notes' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('cell', { name: 'Bravo' })).toBeInTheDocument();
  });

  it('asks for a sort when a sortable header is pressed, and reports the current one', async () => {
    const onSortChange = vi.fn<(next: SortState<SortKey>) => void>();
    render(<DataTable {...base} rows={ROWS} sort={{ key: 'name', dir: 'asc' }} onSortChange={onSortChange} />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Name' }));

    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', dir: 'desc' });
    // A column without a sort key is a plain header.
    expect(within(screen.getByRole('columnheader', { name: 'Status' })).queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers each row its actions in a menu named for the row', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<DataTable {...base} rows={ROWS} rowActions={(row) => [{ label: 'Edit', onSelect: () => onEdit(row.id) }]} />);

    await user.click(screen.getByRole('button', { name: 'Actions for Bravo' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledWith('p2');
  });

  it('selects one row, and all rows from the header', async () => {
    const onChange = vi.fn<(selected: Set<string>) => void>();
    const user = userEvent.setup();
    const { rerender } = render(<DataTable {...base} rows={ROWS} selection={{ selected: new Set(), onChange }} />);

    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    expect(onChange).toHaveBeenLastCalledWith(new Set(['p1']));

    rerender(<DataTable {...base} rows={ROWS} selection={{ selected: new Set(['p1']), onChange }} />);
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toHaveAttribute('aria-checked', 'mixed');
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(onChange).toHaveBeenLastCalledWith(new Set(['p1', 'p2']));
  });

  it('shows the range and pages', async () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        {...base}
        rows={ROWS}
        itemLabel="notes"
        pagination={{ page: 1, pageSize: 2, total: 5, totalPages: 3 }}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByText(/1.2 of 5 notes/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('shows placeholder rows while loading, and says so', () => {
    render(<DataTable {...base} rows={[]} isLoading itemLabel="notes" empty={<p>No notes yet</p>} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading notes');
    expect(screen.queryByText('No notes yet')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no rows, and no pagination', () => {
    render(
      <DataTable
        {...base}
        rows={[]}
        empty={<p>No notes yet</p>}
        pagination={{ page: 1, pageSize: 20, total: 0, totalPages: 0 }}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText('No notes yet')).toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();
  });
});
