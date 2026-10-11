import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DataTable, type DataTableColumn } from './DataTable';
import { SegmentedBar, type SegmentedBarItem } from './SegmentedBar';
import { TableToolbar } from './TableToolbar';

const ITEMS: SegmentedBarItem[] = [
  { id: 'planned', label: 'Planned', value: 7 },
  { id: 'active', label: 'Active', value: 1200, tone: 'info' },
  { id: 'on_hold', label: 'On hold', value: 0, tone: 'warning' },
];

describe('SegmentedBar', () => {
  it('writes every part out as a name and a number, including a part of nothing', () => {
    render(<SegmentedBar label="Notes by status" items={ITEMS} />);

    const legend = within(screen.getByRole('list', { name: 'Notes by status' })).getAllByRole('listitem');
    expect(legend.map((item) => item.textContent)).toEqual(['Planned7', 'Active1,200', 'On hold0']);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('draws a segment for each part that has something in it, sized by its share', () => {
    const { container } = render(<SegmentedBar label="Notes by status" items={ITEMS} />);

    const segments = [...container.querySelectorAll<HTMLElement>('[data-segment]')];
    expect(segments.map((segment) => segment.dataset.segment)).toEqual(['planned', 'active']);
    expect(segments.map((segment) => segment.style.flexGrow)).toEqual(['7', '1200']);
  });

  it('draws no segments when every part is zero', () => {
    const { container } = render(<SegmentedBar label="Empty" items={[{ id: 'none', label: 'None', value: 0 }]} />);

    expect(container.querySelectorAll('[data-segment]')).toHaveLength(0);
  });

  it('becomes a filter with onSelect: pressing a part selects it, pressing it again clears', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SegmentedBar label="Notes by status" items={ITEMS} onSelect={onSelect} />);

    const active = screen.getByRole('button', { name: 'Active, 1,200' });
    expect(active).toHaveAttribute('aria-pressed', 'false');
    await user.click(active);
    expect(onSelect).toHaveBeenLastCalledWith('active');

    rerender(<SegmentedBar label="Notes by status" items={ITEMS} selected="active" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'Active, 1,200' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Planned, 7' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Active, 1,200' }));
    expect(onSelect).toHaveBeenLastCalledWith(undefined);
  });

  it('can be worked from the keyboard', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedBar label="Notes by status" items={ITEMS} onSelect={onSelect} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Planned, 7' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('planned');
  });

  it('shows what it is given at the end of the legend', () => {
    render(<SegmentedBar label="Notes by status" items={ITEMS} trailing={<span>3 overdue</span>} />);

    expect(screen.getByText('3 overdue')).toBeInTheDocument();
  });
});

interface Row {
  readonly id: string;
  readonly name: string;
}

const COLUMNS: DataTableColumn<Row, never>[] = [{ id: 'name', header: 'Name', cell: (row) => row.name }];
const ROWS: Row[] = [{ id: 'r1', name: 'Launch' }];

describe('DataTable toolbar', () => {
  it('shows the toolbar inside the table card, above the headers', () => {
    const { container } = render(
      <DataTable
        label="Notes"
        columns={COLUMNS}
        rows={ROWS}
        rowId={(row) => row.id}
        rowLabel={(row) => row.name}
        toolbar={<TableToolbar search={{ value: '', onChange: vi.fn(), placeholder: 'Search notes' }} rightContent="1 note" />}
      />,
    );

    const card = container.querySelector('[data-slot="data-table"]');
    const toolbar = container.querySelector('[data-slot="data-table-toolbar"]');
    expect(card?.firstElementChild).toBe(toolbar);
    expect(within(toolbar as HTMLElement).getByPlaceholderText('Search notes')).toBeInTheDocument();
    expect(within(toolbar as HTMLElement).getByText('1 note')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Notes' })).toBeInTheDocument();
  });

  it('keeps the toolbar while the rows load and when there are none', () => {
    const toolbar = <TableToolbar search={{ value: 'zzz', onChange: vi.fn(), placeholder: 'Search notes' }} />;
    const base = { label: 'Notes', columns: COLUMNS, rowId: (row: Row) => row.id, rowLabel: (row: Row) => row.name, toolbar };
    const { rerender } = render(<DataTable {...base} rows={[]} isLoading />);

    expect(screen.getByPlaceholderText('Search notes')).toHaveValue('zzz');

    rerender(<DataTable {...base} rows={[]} empty={<p>No notes match.</p>} />);
    expect(screen.getByPlaceholderText('Search notes')).toHaveValue('zzz');
    expect(screen.getByText('No notes match.')).toBeInTheDocument();
  });

  it('has no toolbar region when it is given none', () => {
    const { container } = render(<DataTable label="Notes" columns={COLUMNS} rows={ROWS} rowId={(row) => row.id} rowLabel={(row) => row.name} />);

    expect(container.querySelector('[data-slot="data-table-toolbar"]')).toBeNull();
  });
});
