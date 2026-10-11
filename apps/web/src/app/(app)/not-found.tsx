import { Button, StatusScreen } from '@app/ui';
import Link from 'next/link';

/** Shown inside the shell for a signed-in address that is not a page. */
export default function AppNotFound() {
  return (
    <StatusScreen code="404" title="This page does not exist" description="The link may be old, or the address mistyped. Everything else is where you left it.">
      <Button asChild>
        <Link href="/">Back to Home</Link>
      </Button>
    </StatusScreen>
  );
}
