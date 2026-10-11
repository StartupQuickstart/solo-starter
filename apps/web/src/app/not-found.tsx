import { Button, StatusScreen } from '@app/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/** Shown for any address that is not a page. */
export default function NotFound() {
  return (
    <StatusScreen
      fullScreen
      code="404"
      title="This page does not exist"
      description="The link may be old, or the address mistyped. Everything else is where you left it."
    >
      <Button asChild size="lg">
        <Link href="/">Back to Home</Link>
      </Button>
    </StatusScreen>
  );
}
