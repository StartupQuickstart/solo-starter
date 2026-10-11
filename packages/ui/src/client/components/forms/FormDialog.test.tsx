import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormDialog, type FormDialogProps } from './FormDialog';

function renderDialog(props: Partial<FormDialogProps> = {}) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="Share a note"
      description="They get an email with a link."
      onSubmit={onSubmit}
      submitLabel="Send link"
      {...props}
    >
      <label htmlFor="email">Email</label>
      <input id="email" name="email" />
    </FormDialog>,
  );
  return { onSubmit, onOpenChange };
}

/** The form inside the dialog. */
function form(): HTMLFormElement {
  const element = screen.getByRole('dialog').querySelector('form');
  if (!element) throw new Error('The dialog has no form');
  return element;
}

describe('FormDialog', () => {
  it('is a dialog named by its title and described by its description', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Share a note' });
    expect(dialog).toHaveAccessibleDescription('They get an email with a link.');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits once when the submit button is pressed', async () => {
    const { onSubmit } = renderDialog();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Send link' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits when Enter is pressed in a field', async () => {
    const { onSubmit } = renderDialog();

    await userEvent.setup().type(screen.getByLabelText('Email'), 'ada@example.com{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not reload the page on submit', () => {
    renderDialog();

    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.submit(form())).toBe(false);
  });

  it('asks to close when Cancel is pressed, without submitting', async () => {
    const { onSubmit, onOpenChange } = renderDialog();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('locks both buttons and ignores a second submit while one is in flight', () => {
    const { onSubmit } = renderDialog({ isLoading: true });

    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    fireEvent.submit(form());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses to submit while the form is not ready', () => {
    const { onSubmit } = renderDialog({ disableSubmit: true });

    expect(screen.getByRole('button', { name: 'Send link' })).toBeDisabled();

    fireEvent.submit(form());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the error it is given', () => {
    renderDialog({ error: 'That person is already has the link' });

    expect(screen.getByText('That person is already has the link')).toBeInTheDocument();
  });

  it('replaces the default buttons with a custom footer', () => {
    renderDialog({ footer: <button type="submit">Save and add another</button> });

    expect(screen.getByRole('button', { name: 'Save and add another' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
