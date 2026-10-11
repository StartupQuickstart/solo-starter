import {
  PageDescription,
  PageHeader,
  PageSection,
  PageTitle,
  PageWrapper,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@app/ui';
import Image from 'next/image';

import {
  KIT_COMPARISON,
  KIT_DEMO_LINK_LABEL,
  KIT_DEMO_URL,
  KIT_LINK_LABEL,
  KIT_SCREENSHOTS,
  KIT_SCREENSHOT_SIZE,
  KIT_UPGRADE_PAGE,
  KIT_URL,
} from './kit-content';
import { KitExternalLink } from './KitExternalLink';

/** The same readable width the settings screens use. */
const PAGE_WIDTH = 'max-w-[72rem]';

/** Prose in a table cell wraps; the table primitive keeps cells on one line by default. */
const PROSE_CELL = 'w-1/2 whitespace-normal px-4 py-4 align-top leading-relaxed sm:px-6';

/**
 * The comparison as a table of two columns. Each subject is its own row
 * group: a heading row that names it, then one row with what this starter has
 * and what the application kit has. Two columns stay readable at phone width.
 */
function ComparisonTable() {
  return (
    <div className="bg-card overflow-hidden rounded-xl shadow-xs">
      <Table className="table-fixed caption-top">
        <TableCaption className="mt-0 px-4 pt-5 pb-1 text-left sm:px-6">{KIT_UPGRADE_PAGE.tableCaption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="text-foreground h-12 w-1/2 px-4 text-sm font-semibold sm:px-6">
              {KIT_UPGRADE_PAGE.starterColumn}
            </TableHead>
            <TableHead scope="col" className="text-foreground h-12 w-1/2 px-4 text-sm font-semibold sm:px-6">
              {KIT_UPGRADE_PAGE.kitColumn}
            </TableHead>
          </TableRow>
        </TableHeader>
        {KIT_COMPARISON.map((row) => (
          <TableBody key={row.id} className="border-t">
            <TableRow className="border-b-0 hover:bg-transparent">
              <TableHead scope="rowgroup" colSpan={2} className="h-auto px-4 pt-4 pb-0 font-semibold tracking-wide uppercase sm:px-6">
                {row.subject}
              </TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell className={`${PROSE_CELL} text-muted-foreground pt-1.5`}>{row.starter}</TableCell>
              <TableCell className={`${PROSE_CELL} pt-1.5`}>{row.kit}</TableCell>
            </TableRow>
          </TableBody>
        ))}
      </Table>
    </div>
  );
}

/** The three pictures of the application kit, each with its caption. */
function Screenshots() {
  return (
    <section aria-labelledby="kit-screenshots-heading">
      <h2 id="kit-screenshots-heading" className="text-[1.0625rem] font-semibold">
        {KIT_UPGRADE_PAGE.screenshotsTitle}
      </h2>
      <div className="mt-4 grid gap-x-5 gap-y-8 xl:grid-cols-3">
        {KIT_SCREENSHOTS.map((shot) => (
          <figure key={shot.id}>
            {/* Served as the file in public/kit: no image service, nothing fetched from another origin. */}
            <Image
              src={shot.src}
              alt={shot.alt}
              width={KIT_SCREENSHOT_SIZE.width}
              height={KIT_SCREENSHOT_SIZE.height}
              unoptimized
              className="h-auto w-full rounded-xl shadow-md"
            />
            <figcaption className="text-muted-foreground mt-3 text-sm">{shot.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * The /upgrade page: what this starter has and what the application kit has
 * in its place, three pictures of the kit, and the way to its page and its
 * live demo. Plain statements, nothing to buy here.
 */
export function KitUpgradeView() {
  return (
    <PageWrapper>
      <PageSection variant="header">
        <PageHeader className={PAGE_WIDTH}>
          <div>
            <PageTitle>{KIT_UPGRADE_PAGE.title}</PageTitle>
            <PageDescription className="mt-1.5 text-sm">{KIT_UPGRADE_PAGE.description}</PageDescription>
          </div>
        </PageHeader>
      </PageSection>

      <PageSection variant="content">
        <div className={`${PAGE_WIDTH} space-y-10`}>
          <ComparisonTable />
          <Screenshots />
          <section aria-labelledby="kit-next-heading" className="bg-card rounded-xl px-6 py-6 shadow-xs sm:px-8">
            <h2 id="kit-next-heading" className="text-[1.0625rem] font-semibold">
              {KIT_UPGRADE_PAGE.nextTitle}
            </h2>
            <p className="text-muted-foreground mt-1.5 max-w-xl text-sm">{KIT_UPGRADE_PAGE.nextBody}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <KitExternalLink href={KIT_URL} label={KIT_LINK_LABEL} />
              <KitExternalLink href={KIT_DEMO_URL} label={KIT_DEMO_LINK_LABEL} variant="outline" />
            </div>
          </section>
        </div>
      </PageSection>
    </PageWrapper>
  );
}
