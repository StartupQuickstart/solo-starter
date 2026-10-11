import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(16_19_24/0.24)] hover:bg-primary-hover',
        destructive:
          'bg-destructive text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(16_19_24/0.24)] hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border border-input bg-card hover:border-foreground/25 hover:bg-muted hover:text-accent-foreground dark:bg-[oklch(0.28_0_0)] dark:border-[oklch(0.35_0_0)] dark:hover:bg-[oklch(0.32_0_0)]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-[oklch(0.30_0_0)] dark:hover:bg-[oklch(0.35_0_0)]',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-[oklch(0.28_0_0)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-11 rounded-md px-6 text-[0.9375rem] has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
