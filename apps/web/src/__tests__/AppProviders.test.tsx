import { useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '@/lib/providers';

/** Who is signed in. Tests change it to sign out or to sign someone else in. */
const session = vi.hoisted(() => ({ userId: 'user_1' as string | null }));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: session.userId !== null, userId: session.userId }),
}));

/** What the server would answer: the signed-in person's own notes. */
const fetchNotes = vi.fn(async () => `notes of ${session.userId ?? 'nobody'}`);

/** Every text this screen has ever painted, in order. */
const painted: string[] = [];

/** A screen as the app writes them: the key names the data, not the person. */
function Notes() {
  const { data } = useQuery({ queryKey: ['notes'], queryFn: fetchNotes });
  const text = data ?? 'Loading';
  painted.push(text);
  return <p>{text}</p>;
}

/** A new element each time, so a rerender really renders. */
const app = () => (
  <AppProviders>
    <Notes />
  </AppProviders>
);

/** A screen that holds something of its own, as an open dialog or a draft would. */
function Held() {
  const [personAtMount] = useState(session.userId);
  return <output>held for {personAtMount}</output>;
}

describe('the query cache', () => {
  beforeEach(() => {
    session.userId = 'user_1';
    fetchNotes.mockClear();
    painted.length = 0;
  });

  it("never paints one person's cached data for another", async () => {
    const { rerender } = render(app());
    expect(await screen.findByText('notes of user_1')).toBeInTheDocument();

    painted.length = 0;
    session.userId = 'user_2';
    rerender(app());

    expect(await screen.findByText('notes of user_2')).toBeInTheDocument();
    // Not once since the switch, not even in the render that noticed it.
    expect(painted).not.toContain('notes of user_1');
    expect(painted[0]).toBe('Loading');
  });

  it('starts empty for the next person to sign in in the same tab', async () => {
    const { rerender } = render(app());
    expect(await screen.findByText('notes of user_1')).toBeInTheDocument();

    painted.length = 0;
    session.userId = null;
    rerender(app());
    session.userId = 'user_2';
    rerender(app());

    expect(await screen.findByText('notes of user_2')).toBeInTheDocument();
    expect(painted).not.toContain('notes of user_1');
  });

  it('does not bring the old data back when the first person signs in again', async () => {
    const { rerender } = render(app());
    expect(await screen.findByText('notes of user_1')).toBeInTheDocument();
    session.userId = 'user_2';
    rerender(app());
    expect(await screen.findByText('notes of user_2')).toBeInTheDocument();

    painted.length = 0;
    session.userId = 'user_1';
    rerender(app());

    // Asked for again, not served from what was held before.
    expect(painted[0]).toBe('Loading');
    expect(await screen.findByText('notes of user_1')).toBeInTheDocument();
    expect(fetchNotes).toHaveBeenCalledTimes(3);
  });

  it('drops what a screen was holding for the previous person', () => {
    const held = () => (
      <AppProviders>
        <Held />
      </AppProviders>
    );
    const { rerender } = render(held());
    expect(screen.getByText('held for user_1')).toBeInTheDocument();

    session.userId = 'user_2';
    rerender(held());

    expect(screen.getByText('held for user_2')).toBeInTheDocument();
  });

  it('keeps what it has while the person stays the same', async () => {
    const { rerender } = render(app());
    expect(await screen.findByText('notes of user_1')).toBeInTheDocument();

    painted.length = 0;
    rerender(app());

    expect(painted).toEqual(['notes of user_1']);
    expect(fetchNotes).toHaveBeenCalledTimes(1);
  });
});
