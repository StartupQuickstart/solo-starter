import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));

import { useSidebar } from '../ui/sidebar';
import { Layout } from './Layout';

const NAVIGATION = {
  groups: [{ id: 'main', title: 'WORKSPACE', items: [{ id: 'dashboard', title: 'Dashboard', url: '/', isActive: true }] }],
};

beforeEach(() => {
  // jsdom has no matchMedia; the sidebar asks it whether the screen is narrow.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});

describe('Layout', () => {
  it('has one main landmark, holding the page and not the header', () => {
    render(
      <Layout navigation={NAVIGATION} userMenu={<button type="button">Account</button>} headerTools={<button type="button">Help</button>}>
        <h1>Dashboard</h1>
      </Layout>,
    );

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(within(main).queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });

  it('groups the header tools apart from the account menu', () => {
    render(
      <Layout navigation={NAVIGATION} userMenu={<button type="button">Account</button>} headerTools={<button type="button">Help</button>}>
        <h1>Dashboard</h1>
      </Layout>,
    );

    const tools = screen.getByRole('group', { name: 'Tools' });
    expect(within(tools).getByRole('button', { name: 'Help' })).toBeInTheDocument();
    expect(within(tools).queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
    // The rule between them is decoration: the group already says they are separate.
    expect(tools.nextElementSibling).toHaveAttribute('data-slot', 'separator');
  });

  it('shows the sidebar footer it is given inside the sidebar, outside the page area', () => {
    render(
      <Layout navigation={NAVIGATION} sidebarFooter={<a href="/plans">See the plans</a>}>
        <h1>Dashboard</h1>
      </Layout>,
    );

    const footerLink = screen.getByRole('link', { name: 'See the plans' });
    expect(footerLink.closest('[data-slot="sidebar"]')).not.toBeNull();
    expect(footerLink.closest('[data-slot="sidebar-footer"]')).not.toBeNull();
    expect(within(screen.getByRole('main')).queryByRole('link', { name: 'See the plans' })).not.toBeInTheDocument();
  });

  it('has no sidebar footer when it is given none', () => {
    const { container } = render(
      <Layout navigation={NAVIGATION}>
        <h1>Dashboard</h1>
      </Layout>,
    );

    expect(container.querySelector('[data-slot="sidebar-footer"]')).toBeNull();
  });

  it('lets the footer read whether the sidebar is collapsed', () => {
    function FooterState() {
      return <p>Sidebar is {useSidebar().state}</p>;
    }

    render(
      <Layout navigation={NAVIGATION} sidebarFooter={<FooterState />}>
        <h1>Dashboard</h1>
      </Layout>,
    );

    expect(screen.getByText('Sidebar is expanded')).toBeInTheDocument();
  });
});
