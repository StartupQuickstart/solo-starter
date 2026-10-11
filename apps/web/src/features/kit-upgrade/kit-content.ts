/**
 * Everything the card and the comparison page say about the application kit,
 * and the two addresses they link to. Written once, here.
 *
 * Each statement about the kit is taken from the "What is included" list in
 * its README. Check them against that list when the kit changes.
 */

/** The application kit's page: what it is and how to get it. */
export const KIT_URL = 'https://www.startupquickstart.com/kits/application-kit';

/** The application kit running on sample data, with nothing to sign up for. */
export const KIT_DEMO_URL = 'https://app-production-0434.up.railway.app';

/** Said to assistive technology on every link that leaves the app. */
export const NEW_TAB_HINT = '(opens in a new tab)';

export const KIT_LINK_LABEL = 'See the application kit';
export const KIT_DEMO_LINK_LABEL = 'Try the live demo';

/** The card at the foot of the sidebar. */
export const KIT_CARD = {
  title: 'Building for teams?',
  lead: 'The application kit is the paid sibling of this starter, on the same stack. It adds:',
  /** The four things, and only these four. */
  points: [
    'Organizations with members, roles and invitations',
    'Billing per organization, with several plans',
    'A designed dashboard with charts and analytics',
    'An AI assistant',
  ],
  compareLabel: 'Compare',
  /** Completes the "Compare" link's name for someone who hears it out of context. */
  compareContext: 'this starter with the application kit',
} as const;

/** One line of the comparison: a subject, what this starter has, what the kit has. */
export interface KitComparisonRow {
  readonly id: string;
  readonly subject: string;
  readonly starter: string;
  readonly kit: string;
}

/** The comparison page. */
export const KIT_UPGRADE_PAGE = {
  title: 'What the application kit adds',
  description:
    'This starter is for an app with one user per account. The application kit is its paid sibling for apps that teams share: the same stack and the same package versions, so moving up is adding features, not migrating.',
  tableCaption: 'What you have in this starter, and what the application kit has in its place.',
  starterColumn: 'This starter',
  kitColumn: 'The application kit',
  screenshotsTitle: 'What it looks like',
  nextTitle: 'Look at it before you decide',
  nextBody: 'The live demo is the application kit running on sample data. There is nothing to sign up for.',
} as const;

export const KIT_COMPARISON: readonly KitComparisonRow[] = [
  {
    id: 'accounts',
    subject: 'Who uses an account',
    starter: 'One person. Every row belongs to one user, and there are no organizations, members, invitations or roles.',
    kit: 'Organizations. People create or join one, switch between them, invite colleagues and change roles.',
  },
  {
    id: 'billing',
    subject: 'Billing',
    starter: 'One plan, per user: a hosted checkout to subscribe and a customer portal to manage or cancel.',
    kit: 'Billing per organization, with several plans to choose from, through a hosted checkout and a billing portal.',
  },
  {
    id: 'dashboard',
    subject: 'Dashboard',
    starter: 'None. Home is the example table.',
    kit: 'A dashboard read from the API: a chart of open projects with figures for created, completed and overdue, workload by owner, due dates and recent activity, over 7, 30 or 90 days.',
  },
  {
    id: 'example',
    subject: 'The example to copy',
    starter: 'Notes, owned by the signed-in user: list, create, edit and delete, and a CSV export that needs a subscription.',
    kit: 'Projects, shared by an organization: a list that keeps its search, filter, sort and page in the address, a form in a dialog, a page per project, and an Analytics page of charts over the same data.',
  },
  {
    id: 'charts',
    subject: 'Charts',
    starter: 'None.',
    kit: 'A chart system: line, area, bar, combined bar and line, donut, funnel and a calendar heatmap. Every chart reads its colours from the design tokens and has a table view of the same numbers.',
  },
  {
    id: 'activity',
    subject: 'Activity and notifications',
    starter: 'None.',
    kit: 'An activity feed that records changes as they are made, and a bell in the header that counts what other people did since you last looked.',
  },
  {
    id: 'assistant',
    subject: 'Assistant',
    starter: 'None.',
    kit: 'A panel where a member asks questions about the organization in plain words and gets answers with lists, figures and charts. It needs a model key on the API and is off without one.',
  },
  {
    id: 'account-screens',
    subject: 'Account screens',
    starter: 'The sign-in provider’s own account page.',
    kit: 'Account settings in three tabs (profile, security, notifications), a profile page per member, and organization settings.',
  },
  {
    id: 'gallery',
    subject: 'Component gallery and demo',
    starter: 'None. The app cannot be tried without a sign-in provider account.',
    kit: 'A gallery in the app that shows every component running with the code to copy, and a public demo build that needs no accounts.',
  },
];

/** A picture of the kit, with the text that stands in for it and the line under it. */
export interface KitScreenshot {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
  readonly caption: string;
}

/** The pictures in `public/kit/` are 1400 by 875. */
export const KIT_SCREENSHOT_SIZE = { width: 1400, height: 875 } as const;

export const KIT_SCREENSHOTS: readonly KitScreenshot[] = [
  {
    id: 'dashboard',
    src: '/kit/dashboard.png',
    alt: 'The application kit’s dashboard for a sample organization: an area chart of open projects over 30 days, figures for created, completed and overdue projects, workload by owner and due dates.',
    caption: 'The dashboard: open projects over the chosen period, with the figures beside it.',
  },
  {
    id: 'analytics',
    src: '/kit/analytics.png',
    alt: 'The application kit’s Analytics page: four figures with small trend lines, a bar chart of projects created and completed each week, and a donut chart of projects by status.',
    caption: 'Analytics: charts over the example resource, Projects.',
  },
  {
    id: 'assistant',
    src: '/kit/assistant.png',
    alt: 'The assistant panel open over the dashboard, answering the question “How are we doing this month?” with two sentences, three figures and a bar chart.',
    caption: 'The assistant, shown here in the public demo, where it answers from sample data.',
  },
];
