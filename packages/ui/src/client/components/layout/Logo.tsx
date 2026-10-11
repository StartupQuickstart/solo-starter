'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import React from 'react';

import { cn } from '../../../shared/lib/utils';

export interface LogoConfig {
  /** Path to the logo image (light mode) */
  src?: string;
  /** Path to the logo image for dark mode */
  srcDark?: string;
  /** Alt text for the logo */
  alt?: string;
  /** Width of the logo in pixels */
  width?: number;
  /** Height of the logo in pixels */
  height?: number;
}

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Custom logo configuration - overrides size presets */
  config?: LogoConfig;
}

// Default size presets
const sizePresets = {
  sm: { width: 110, height: 40 },
  md: { width: 130, height: 48 },
  lg: { width: 150, height: 56 },
};

export function Logo({ className, href = '/', size = 'md', config, ...props }: LogoProps) {
  // An app that forces one theme (forcedTheme) still gets the visitor's system
  // preference back as resolvedTheme, so the forced theme has to win here.
  const { resolvedTheme, forcedTheme } = useTheme();
  const activeTheme = forcedTheme ?? resolvedTheme;

  // Use config values if provided, otherwise use size presets
  const dimensions =
    config?.width || config?.height
      ? { width: config.width ?? sizePresets[size].width, height: config.height ?? sizePresets[size].height }
      : sizePresets[size];

  // Use dark logo if available and in dark mode
  const logoSrc =
    activeTheme === 'dark' && config?.srcDark
      ? config.srcDark
      : (config?.src ?? '/images/logo-color.svg');

  const logoImage = (
    <Image
      src={logoSrc}
      alt={config?.alt ?? 'Logo'}
      width={dimensions.width}
      height={dimensions.height}
      className="object-contain"
    />
  );

  if (href) {
    return (
      <div className={cn('flex items-center', className)} {...props}>
        <Link
          href={href}
          className="focus:ring-primary flex items-center rounded focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          {logoImage}
        </Link>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center', className)} {...props}>
      {logoImage}
    </div>
  );
}
