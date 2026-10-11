'use client';

import { Button, StatusScreen } from '@app/ui';

import { APP_CONFIG } from '@/config/app.config';

interface ErrorBoundaryProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

/** Shown when a page outside the signed-in shell throws. */
export default function RootError({ error, reset }: ErrorBoundaryProps) {
  return (
    <StatusScreen
      fullScreen
      title="Something went wrong"
      description={
        <>
          The page hit an error it did not expect. Try again; if it keeps happening, write to{' '}
          <a href={`mailto:${APP_CONFIG.supportEmail}`} className="text-primary font-medium hover:underline">
            {APP_CONFIG.supportEmail}
          </a>
          {error.digest ? ` and mention reference ${error.digest}.` : '.'}
        </>
      }
    >
      <Button size="lg" onClick={reset}>
        Try again
      </Button>
    </StatusScreen>
  );
}
