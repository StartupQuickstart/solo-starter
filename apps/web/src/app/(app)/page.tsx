import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';

// EXAMPLE: notes. Home shows the example feature; replace the import and the view with your own.
import { NotesView } from '@/features/notes/NotesView';

export const metadata: Metadata = { title: 'Home' };

// Rendered per request: the page needs the session, and the build has no session.
export const dynamic = 'force-dynamic';

/** Home. Signed-in people only; everyone else is sent to sign in. */
export default async function HomePage() {
  await auth.protect();
  // EXAMPLE: notes.
  return <NotesView />;
}
