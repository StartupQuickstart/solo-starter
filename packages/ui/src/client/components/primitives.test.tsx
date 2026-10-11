import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TablePagination } from './data/TablePagination';
import { ConfirmDialog } from './dialogs/ConfirmDialog';
import { SearchInput } from './inputs/SearchInput';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './ui/breadcrumb';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Skeleton } from './ui/skeleton';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

/**
 * The primitives the rest of the library is built from. Each is checked for
 * what an app relies on: its role and name, and that it works from the
 * keyboard.
 */

describe('Button', () => {
  it('is a button that fires on click and on the keyboard', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Save</Button>);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does nothing while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('can render as a link and keep its look', () => {
    render(
      <Button asChild variant="outline">
        <a href="/notes">Notes</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/notes');
  });
});

describe('Input and Textarea', () => {
  it('take text and are found by their label', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="name">Name</Label>
        <Input id="name" />
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" />
      </>,
    );

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Notes'), 'Hello');

    expect(screen.getByLabelText('Name')).toHaveValue('Ada');
    expect(screen.getByLabelText('Notes')).toHaveValue('Hello');
  });
});

describe('Checkbox and Switch', () => {
  it('toggle with the space bar and report the new state', async () => {
    const onChecked = vi.fn();
    const onSwitched = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <Checkbox aria-label="Send me updates" onCheckedChange={onChecked} />
        <Switch aria-label="Dark mode" onCheckedChange={onSwitched} />
      </>,
    );

    screen.getByRole('checkbox', { name: 'Send me updates' }).focus();
    await user.keyboard(' ');
    screen.getByRole('switch', { name: 'Dark mode' }).focus();
    await user.keyboard(' ');

    expect(onChecked).toHaveBeenCalledWith(true);
    expect(onSwitched).toHaveBeenCalledWith(true);
  });
});

describe('RadioGroup', () => {
  it('offers one choice among several, chosen with the space bar', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RadioGroup aria-label="Role" defaultValue="viewer" onValueChange={onValueChange}>
        <RadioGroupItem value="viewer" aria-label="Viewer" />
        <RadioGroupItem value="admin" aria-label="Admin" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radio', { name: 'Viewer' })).toBeChecked();
    screen.getByRole('radio', { name: 'Admin' }).focus();
    await user.keyboard(' ');

    expect(onValueChange).toHaveBeenCalledWith('admin');
  });
});

describe('Select', () => {
  it('shows the chosen option on a labelled trigger', () => {
    render(
      <Select value="active" onValueChange={vi.fn()}>
        <SelectTrigger aria-label="Status">
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="planned">Planned</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Active');
  });
});

describe('Dialog and Sheet', () => {
  it('open from their trigger, are named by their title, and close on Escape', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename note</DialogTitle>
              <DialogDescription>Choose a new name.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger>Open sheet</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Note details</SheetTitle>
              <SheetDescription>Everything about this note.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(await screen.findByRole('dialog', { name: 'Rename note' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    expect(await screen.findByRole('dialog', { name: 'Note details' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('asks before a destructive action, and does nothing on Cancel', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete note?"
        description="This cannot be undone."
        confirmLabel="Delete note"
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole('alertdialog', { name: 'Delete note?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete note' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('locks its buttons while the action runs and shows a failure', () => {
    render(
      <ConfirmDialog open onOpenChange={vi.fn()} title="Delete note?" description="x" isLoading error="Could not delete." onConfirm={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByText('Could not delete.')).toBeInTheDocument();
  });
});

describe('DropdownMenu', () => {
  it('opens from the keyboard and runs the chosen item', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Options</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    screen.getByRole('button', { name: 'Options' }).focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('Tabs', () => {
  it('shows one panel at a time and moves with the arrow keys', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Note">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="history">History panel</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole('tabpanel')).toHaveTextContent('Overview panel');
    screen.getByRole('tab', { name: 'Overview' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('History panel');
  });
});

describe('Tooltip', () => {
  it('describes its trigger when the trigger is focused', async () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Help</TooltipTrigger>
          <TooltipContent>Shown to everyone</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    await userEvent.setup().tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Shown to everyone');
  });
});

describe('Alert, Badge, Avatar, Card, Skeleton', () => {
  it('Alert is announced, with a title and a description', () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Billing is not set up.</AlertDescription>
      </Alert>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Heads upBilling is not set up.');
  });

  it('Badge and Card show their content; Avatar falls back to initials without an image', () => {
    render(
      <>
        <Badge variant="secondary">Beta</Badge>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>Six people</CardContent>
        </Card>
        <Avatar>
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
      </>,
    );

    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Six people')).toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('Skeleton is decoration: it has no role and no text', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);

    expect(container).toHaveTextContent('');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Breadcrumb', () => {
  it('is a navigation landmark whose last item is the current page', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/notes">Notes</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Launch</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(within(nav).getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/notes');
    expect(within(nav).getByText('Launch')).toHaveAttribute('aria-current', 'page');
  });
});

describe('TablePagination', () => {
  it('shows the range, disables Previous on the first page, and asks for the next', async () => {
    const onPageChange = vi.fn();
    render(<TablePagination pagination={{ page: 1, pageSize: 20, total: 45, totalPages: 3 }} onPageChange={onPageChange} itemLabel="notes" />);

    expect(screen.getByText(/1.20 of 45 notes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('has no page buttons when everything fits on one page', () => {
    render(<TablePagination pagination={{ page: 1, pageSize: 20, total: 3, totalPages: 1 }} onPageChange={vi.fn()} itemLabel="notes" />);

    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});

describe('SearchInput', () => {
  it('reports what is typed and clears with its button', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SearchInput value="" onChange={onChange} placeholder="Search notes" />);

    await user.type(screen.getByRole('textbox', { name: 'Search notes' }), 'a');
    expect(onChange).toHaveBeenCalledWith('a');

    rerender(<SearchInput value="alpha" onChange={onChange} placeholder="Search notes" />);
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
