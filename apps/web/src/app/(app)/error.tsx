'use client';

import { Button, StatusScreen } from '@app/ui';
import Link from 'next/link';

import { APP_CONFIG } from '@/config/app.config';

interface ErrorBoundaryProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

/** Shown inside the shell when a signed-in page throws. The navigation keeps working around it. */
export default function AppError({ error, reset }: ErrorBoundaryProps) {
  return (
    <StatusScreen
      title="Something went wrong"
      description={
        <>
          This page hit an error it did not expect. Your other pages are unaffected. If it keeps happening, write to{' '}
          <a href={`mailto:${APP_CONFIG.supportEmail}`} className="text-primary font-medium hover:underline">
            {APP_CONFIG.supportEmail}
          </a>
          {error.digest ? ` and mention reference ${error.digest}.` : '.'}
        </>
      }
    >
      <Button onClick={reset}>Try again</Button>
      <Button asChild variant="outline">
        <Link href="/">Back to Home</Link>
      </Button>
    </StatusScreen>
  );
}
