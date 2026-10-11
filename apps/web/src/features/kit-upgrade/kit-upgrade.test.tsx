import { SidebarProvider } from '@app/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppLayout from '@/app/(app)/layout';
import UpgradePage from '@/app/(app)/upgrade/page';
import { parseAppConfig } from '@/config/app.config';

import { KitUpgradeCard } from './KitUpgradeCard';

/**
 * The application kit card, the /upgrade page and the one setting that
 * switches both off. Clerk is mocked the way the other suites mock it.
 */

const KIT_URL = 'https://www.startupquickstart.com/kits/application-kit';
const DEMO_URL = 'https://app-production-0434.up.railway.app';
const KIT_LINK = 'See the application kit (opens in a new tab)';
const DEMO_LINK = 'Try the live demo (opens in a new tab)';
const COMPARE_LINK = 'Compare this starter with the application kit';
const CARD_TITLE = 'Building for teams?';

/** The setting as the build would have read it. Tests switch it off. */
const flag = vi.hoisted(() => ({ showKitCard: true }));

vi.mock('@/config/app.config', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/config/app.config')>();
  return {
    ...original,
    APP_CONFIG: {
      ...original.APP_CONFIG,
      get showKitCard() {
        return flag.showKitCard;
      },
    },
  };
});

const protect = vi.hoisted(() => vi.fn(async () => ({ userId: 'user_test' })));
vi.mock('@clerk/nextjs/server', () => ({ auth: Object.assign(vi.fn(), { protect }) }));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isLoaded: true, getToken: async () => 'test-token' }),
  UserButton: () => <button type="button">Account menu</button>,
}));

// A plain anchor that stays on the page when followed: jsdom cannot load another document.
vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...rest }: { href: string; children: ReactNode; onClick?: () => void }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

/** Stands in for Next.js ending the render with its not-found screen. */
const NOT_FOUND = 'NEXT_NOT_FOUND';
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
// The in-memory router the other suites get from setup.ts, with `notFound` observable.
vi.mock('next/navigation', async (importOriginal) => {
  const [original, { navigationHooks }] = await Promise.all([
    importOriginal<typeof import('next/navigation')>(),
    import('@/__tests__/helpers/navigation'),
  ]);
  return { ...original, ...navigationHooks, notFound };
});

/** jsdom has no matchMedia; the sidebar asks it whether the screen is narrow. */
function setScreen({ narrow }: { readonly narrow: boolean }) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: narrow, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

beforeEach(() => {
  flag.showKitCard = true;
  protect.mockClear();
  notFound.mockClear();
  setScreen({ narrow: false });
});

function renderCard({ sidebarOpen }: { readonly sidebarOpen: boolean }) {
  return render(
    <SidebarProvider open={sidebarOpen}>
      <KitUpgradeCard />
    </SidebarProvider>,
  );
}

function renderShell() {
  return render(
    <AppLayout>
      <h1>Notes</h1>
    </AppLayout>,
  );
}

describe('the application kit card', () => {
  it('says what the kit adds, in four points', () => {
    renderCard({ sidebarOpen: true });

    const card = screen.getByRole('complementary', { name: CARD_TITLE });
    expect(within(card).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Organizations with members, roles and invitations',
      'Billing per organization, with several plans',
      'A designed dashboard with charts and analytics',
      'An AI assistant',
    ]);
  });

  it("links to the kit's page in a new tab, without handing it a reference back", () => {
    renderCard({ sidebarOpen: true });

    const link = screen.getByRole('link', { name: KIT_LINK });
    expect(link).toHaveAttribute('href', KIT_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links to the comparison page inside the app', () => {
    renderCard({ sidebarOpen: true });

    const link = screen.getByRole('link', { name: COMPARE_LINK });
    expect(link).toHaveAttribute('href', '/upgrade');
    expect(link).not.toHaveAttribute('target');
  });

  it('is one icon link with a name when the sidebar is collapsed to icons', () => {
    renderCard({ sidebarOpen: false });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(KIT_LINK);
    expect(links[0]).toHaveAttribute('href', KIT_URL);
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText(CARD_TITLE)).not.toBeInTheDocument();
  });

  it('shows its destination as a tooltip when the icon is focused', async () => {
    const user = userEvent.setup();
    renderCard({ sidebarOpen: false });

    await user.tab();

    expect(screen.getByRole('link', { name: KIT_LINK })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('See the application kit');
  });
});

describe('the signed-in shell', () => {
  it('has the card in its sidebar, outside the page area', () => {
    renderShell();

    const card = screen.getByRole('complementary', { name: CARD_TITLE });
    expect(card.closest('[data-slot="sidebar"]')).not.toBeNull();
    expect(within(screen.getByRole('main')).queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('keeps the navigation at Home, Billing and Account: the comparison page has no entry', () => {
    renderShell();

    const sidebar = screen.getByRole('complementary', { name: CARD_TITLE }).closest('[data-slot="sidebar"]');
    if (!(sidebar instanceof HTMLElement)) throw new Error('The card is not inside the sidebar');
    const navigation = within(sidebar).getAllByRole('list')[0];
    if (!navigation) throw new Error('The sidebar has no navigation list');
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual(['Home', 'Billing', 'Account']);
  });

  it('on a phone, has the card inside the menu and closes the menu when Compare is followed', async () => {
    setScreen({ narrow: true });
    const user = userEvent.setup();
    renderShell();

    // The menu is closed: the card is not on the page.
    expect(screen.queryByRole('complementary', { name: CARD_TITLE })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    const menu = await screen.findByRole('dialog');
    expect(within(menu).getByRole('complementary', { name: CARD_TITLE })).toBeInTheDocument();

    await user.click(within(menu).getByRole('link', { name: COMPARE_LINK }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no card and no link to the kit when the setting is off', () => {
    flag.showKitCard = false;
    const { container } = renderShell();

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /application kit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /compare/i })).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="sidebar-footer"]')).toBeNull();
  });

  it('has no card in the phone menu either when the setting is off', async () => {
    flag.showKitCard = false;
    setScreen({ narrow: true });
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    const menu = await screen.findByRole('dialog');

    expect(within(menu).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(menu).queryByRole('complementary')).not.toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: /application kit/i })).not.toBeInTheDocument();
  });
});

describe('the /upgrade page', () => {
  it('compares this starter with the kit in a table with a caption', async () => {
    render(await UpgradePage());

    expect(screen.getByRole('heading', { level: 1, name: 'What the application kit adds' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'What you have in this starter, and what the application kit has in its place.' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['This starter', 'The application kit']);
    // Each subject heads its own group of rows.
    expect(within(table).getAllByRole('rowheader').map((header) => header.textContent)).toEqual([
      'Who uses an account',
      'Billing',
      'Dashboard',
      'The example to copy',
      'Charts',
      'Activity and notifications',
      'Assistant',
      'Account screens',
      'Component gallery and demo',
    ]);
    expect(within(table).getByText(/^One plan, per user/)).toBeInTheDocument();
    expect(within(table).getByText(/^Billing per organization, with several plans/)).toBeInTheDocument();
    expect(within(table).getByText(/^Organizations\. People create or join one/)).toBeInTheDocument();
  });

  it('says that the stack and the package versions are the same', async () => {
    render(await UpgradePage());

    expect(screen.getByText(/the same stack and the same package versions, so moving up is adding features, not migrating/)).toBeInTheDocument();
  });

  it('shows three pictures of the kit, each with a description and a caption', async () => {
    render(await UpgradePage());

    const pictures = screen.getAllByRole('img');
    expect(pictures.map((picture) => picture.getAttribute('src'))).toEqual(['/kit/dashboard.png', '/kit/analytics.png', '/kit/assistant.png']);
    for (const picture of pictures) {
      expect(picture.getAttribute('alt')?.length ?? 0).toBeGreaterThan(40);
      expect(picture.closest('figure')?.querySelector('figcaption')).toHaveTextContent(/\w/);
    }
    expect(screen.getByRole('img', { name: /dashboard for a sample organization/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Analytics page/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /assistant panel open over the dashboard/ })).toBeInTheDocument();
  });

  it("ends with the way to the kit's page and to its live demo, both in a new tab", async () => {
    render(await UpgradePage());

    const kit = screen.getByRole('link', { name: KIT_LINK });
    expect(kit).toHaveAttribute('href', KIT_URL);
    const demo = screen.getByRole('link', { name: DEMO_LINK });
    expect(demo).toHaveAttribute('href', DEMO_URL);
    for (const link of [kit, demo]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('checks the session before it shows anything', async () => {
    await UpgradePage();

    expect(protect).toHaveBeenCalledTimes(1);
    expect(notFound).not.toHaveBeenCalled();
  });

  it('answers not-found when the setting is off', async () => {
    flag.showKitCard = false;

    await expect(UpgradePage()).rejects.toThrow(NOT_FOUND);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('turns a signed-out visitor away before it says whether the page exists', async () => {
    flag.showKitCard = false;
    protect.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(UpgradePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('NEXT_PUBLIC_SHOW_KIT_CARD', () => {
  it.each([
    ['unset', {}],
    ['empty', { NEXT_PUBLIC_SHOW_KIT_CARD: '' }],
    ['1', { NEXT_PUBLIC_SHOW_KIT_CARD: '1' }],
  ])('shows the card when it is %s', (_label, source) => {
    expect(parseAppConfig(source).showKitCard).toBe(true);
  });

  it('hides the card when it is exactly 0', () => {
    expect(parseAppConfig({ NEXT_PUBLIC_SHOW_KIT_CARD: '0' }).showKitCard).toBe(false);
  });

  it.each(['yes', 'no', 'true', 'false', 'off', '2', ' 0', '00'])('refuses %j and names the variable', (value) => {
    expect(() => parseAppConfig({ NEXT_PUBLIC_SHOW_KIT_CARD: value })).toThrow(/NEXT_PUBLIC_SHOW_KIT_CARD/);
  });
});
