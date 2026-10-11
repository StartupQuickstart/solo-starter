'use client';

import { Fragment, type ReactNode } from 'react';

import { useBreadcrumbs, useHeaderActions, useLayoutConfig, type BreadcrumbData } from '../../contexts';
import { ThemeToggle } from '../theme/ThemeToggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';
import { Separator } from '../ui/separator';
import { SidebarTrigger } from '../ui/sidebar';

export interface AppHeaderProps {
  /** Shown at the end of the header: the account control. */
  readonly userMenu?: ReactNode;
  /**
   * Icon buttons that belong to the app, not to the person. They sit in their
   * own group, set apart from the account control by a divider.
   */
  readonly tools?: ReactNode;
}

export function AppHeader({ userMenu, tools }: AppHeaderProps) {
  const { breadcrumbs } = useBreadcrumbs();
  const headerActions = useHeaderActions();
  const showThemeToggle = useLayoutConfig()?.themeToggle !== false;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger />
        {headerActions && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            {headerActions}
          </>
        )}
        {breadcrumbs.length > 0 && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((breadcrumb: BreadcrumbData, index: number) => {
                  const isLast = index === breadcrumbs.length - 1;

                  return (
                    <Fragment key={breadcrumb.id}>
                      <BreadcrumbItem className={index === 0 ? 'hidden md:block' : undefined}>
                        {breadcrumb.isCurrentPage || isLast ? (
                          <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={breadcrumb.href}>{breadcrumb.label}</BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator className={index === 0 ? 'hidden md:block' : undefined} />}
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </>
        )}
      </div>
      {showThemeToggle && (
        <>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <ThemeToggle />
        </>
      )}
      {tools && (
        <>
          <div role="group" aria-label="Tools" className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {tools}
          </div>
          {/* A taller, fully visible rule: the tools and the account are two different things. */}
          <Separator orientation="vertical" className="bg-input mx-2 !h-7 sm:mx-3" />
        </>
      )}
      {userMenu}
    </header>
  );
}
