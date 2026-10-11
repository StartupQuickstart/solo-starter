import type { ReactNode } from 'react';

import {
  PageDescription,
  PageHeader,
  PageSection,
  PageTitle,
  PageWrapper,
} from '@app/ui';

/**
 * How wide a screen's header and content may grow.
 * - `form`: capped at a readable width, so labels and their cards stay close
 *   together on a large monitor. The default, for settings and forms.
 * - `full`: the whole page, for screens whose content is a table.
 */
export const SETTINGS_PAGE_WIDTH = {
  form: 'form',
  full: 'full',
} as const;

export type SettingsPageWidth = (typeof SETTINGS_PAGE_WIDTH)[keyof typeof SETTINGS_PAGE_WIDTH];

const WIDTH_CLASSES = {
  [SETTINGS_PAGE_WIDTH.form]: 'max-w-[72rem]',
  [SETTINGS_PAGE_WIDTH.full]: '',
} as const satisfies Record<SettingsPageWidth, string>;

export interface SettingsPageProps {
  readonly title: string;
  readonly description: string;
  /** The page's one primary action, shown at the right of the header. */
  readonly action?: ReactNode;
  /** See {@link SETTINGS_PAGE_WIDTH}. Defaults to `form`. */
  readonly width?: SettingsPageWidth;
  readonly children: ReactNode;
}

/**
 * The frame settings screens share (Billing, Account): the same header, the same width rule, and the same rhythm between sections.
 * A screen that needs something this does not offer extends this component;
 * it does not build its own header.
 */
export function SettingsPage({
  title,
  description,
  action,
  width = SETTINGS_PAGE_WIDTH.form,
  children,
}: SettingsPageProps) {
  const widthClass = WIDTH_CLASSES[width];

  return (
    <PageWrapper>
      <PageSection variant="header">
        <PageHeader className={widthClass}>
          <div>
            <PageTitle>{title}</PageTitle>
            <PageDescription className="mt-1.5 text-sm">{description}</PageDescription>
          </div>
          {action}
        </PageHeader>
      </PageSection>

      <PageSection variant="content">
        <div className={`${widthClass} divide-y [&>*]:py-8 [&>*:first-child]:pt-2 [&>*:last-child]:pb-0`}>{children}</div>
      </PageSection>
    </PageWrapper>
  );
}

export interface SettingsSectionProps {
  readonly title: string;
  readonly description?: ReactNode;
  readonly children: ReactNode;
}

/**
 * One topic on a settings screen: its name and a line of explanation on the
 * left (two fifths of the width), the controls on the right. Stacks on narrow
 * screens.
 */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <h2 className="text-[1.0625rem] font-semibold">{title}</h2>
        {description != null && <p className="text-muted-foreground mt-1 max-w-md text-sm">{description}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

export interface SettingsCardProps {
  readonly children: ReactNode;
  /** A bar under the content, for the card's action or a note about it. */
  readonly footer?: ReactNode;
  readonly className?: string;
}

/**
 * The card surface settings controls sit on, matching the table card used for
 * lists. The optional footer holds the save button or a note.
 */
export function SettingsCard({ children, footer, className }: SettingsCardProps) {
  return (
    <div className={`bg-card overflow-hidden rounded-xl shadow-xs ${className ?? ''}`}>
      <div className="p-6">{children}</div>
      {footer != null && (
        <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3.5">{footer}</div>
      )}
    </div>
  );
}
