import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/client/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface BackButtonProps {
  href: string;
  children?: React.ReactNode;
  className?: string;
}

export function BackButton({ href, children = 'Back', className }: BackButtonProps) {
  return (
    <Button variant="ghost" size="sm" asChild className={cn('-ml-2 mb-2 w-fit', className)}>
      <Link href={href}>
        <ArrowLeft className="size-4" />
        {children}
      </Link>
    </Button>
  );
}
