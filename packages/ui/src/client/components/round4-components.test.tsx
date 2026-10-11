import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlarmClock } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BreakdownList } from './data/BreakdownList';
import { StatusScreen } from './feedback/StatusScreen';
import { SegmentedControl } from './inputs/SegmentedControl';
import { Panel } from './page/Panel';

describe('SegmentedControl', () => {
  const OPTIONS = [
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
  ] as const;

  function Harness({ onChange }: { readonly onChange: (value: string) => void }) {
    const [value, setValue] = useState<(typeof OPTIONS)[number]['value']>('30');
    return (
      <SegmentedControl
        label="Date range"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }

  it('is a named radio group with the current option checked', () => {
    render(<Harness onChange={vi.fn()} />);

    const group = screen.getByRole('radiogroup', { name: 'Date range' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getByRole('radio', { name: '30 days' })).toBeChecked();
  });

  it('reports the option that is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: '90 days' }));

    expect(onChange).toHaveBeenCalledWith('90');
    expect(screen.getByRole('radio', { name: '90 days' })).toBeChecked();
  });

  // Arrow-key roving is the radio group primitive's own and does not run in jsdom; the browser suite covers it.
  it('can be chosen from the keyboard', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    screen.getByRole('radio', { name: '90 days' }).focus();
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith('90');
  });
});

describe('Panel', () => {
  it('is a named region with its title as a heading, a description and actions', () => {
    render(
      <Panel title="Workload by owner" description="Open notes for each person." actions={<a href="/notes">All notes</a>}>
        <p>content</p>
      </Panel>,
    );

    const region = screen.getByRole('region', { name: 'Workload by owner' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Workload by owner' })).toBeInTheDocument();
    expect(within(region).getByText('Open notes for each person.')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'All notes' })).toBeInTheDocument();
    expect(within(region).getByText('content')).toBeInTheDocument();
  });

  it('can sit under a higher heading', () => {
    render(
      <Panel title="Due dates" as="h3">
        <p>content</p>
      </Panel>,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Due dates' })).toBeInTheDocument();
  });
});

describe('BreakdownList', () => {
  it('lists each amount by name, with the number written out', () => {
    render(
      <BreakdownList
        label="Open notes by due date"
        items={[
          { label: 'Overdue', value: 3, tone: 'error', icon: AlarmClock },
          { label: 'Due later', value: 1200 },
        ]}
      />,
    );

    const items = within(screen.getByRole('list', { name: 'Open notes by due date' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Overdue3', 'Due later1,200']);
  });

  it('draws nothing wider than nothing when every amount is zero', () => {
    const { container } = render(<BreakdownList label="Empty" items={[{ label: 'None', value: 0 }]} />);

    expect(container.querySelector('[style]')).toHaveStyle({ width: '0%' });
  });
});

describe('StatusScreen', () => {
  it('says what happened as the page heading and offers the way out', () => {
    render(
      <StatusScreen code="404" title="This page does not exist" description="The link may be old.">
        <a href="/">Back to the dashboard</a>
      </StatusScreen>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'This page does not exist' })).toBeInTheDocument();
    expect(screen.getByText('The link may be old.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the dashboard' })).toBeInTheDocument();
  });

  it('keeps the large code out of the accessible text, since the title says it in words', () => {
    render(<StatusScreen code="404" title="This page does not exist" description="The link may be old." />);

    expect(screen.getByText('404')).toHaveAttribute('aria-hidden', 'true');
  });

  it('can be a section of a page that already has its heading', () => {
    render(<StatusScreen as="h2" title="You do not have access" description="Ask an admin." />);

    expect(screen.getByRole('heading', { level: 2, name: 'You do not have access' })).toBeInTheDocument();
  });
});
