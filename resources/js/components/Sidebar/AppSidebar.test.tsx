import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

// Mutable page state consumed by the mocked usePage() below.
let pageProps: Record<string, unknown> = {};
let pageUrl = '/projects';

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps, url: pageUrl }),
    Link: ({ href, children, ...rest }: { href: string; children?: ReactNode; [key: string]: unknown }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}));

// AppSidebar renders ApplicationLogo, which needs ThemeContext.
vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({ resolvedTheme: 'light', theme: 'light', setTheme: () => {} }),
}));

import { AppSidebar } from './AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

const baseUser = { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'user' as const };

function basePageProps(overrides: Record<string, unknown> = {}) {
    return {
        appSettings: {
            referral_enabled: false,
            site_name: 'Webby',
            site_tagline: 'Build with AI',
            site_logo: null,
            site_logo_dark: null,
            color_theme: 'neutral',
        },
        recentProjects: null,
        hasUpgradablePlans: false,
        databaseEnabled: false,
        canUseGithub: false,
        canConnectShopify: false,
        canUseApi: false,
        fileStorageEnabled: false,
        ...overrides,
    };
}

function renderSidebar(user = baseUser, props: Record<string, unknown> = {}) {
    pageProps = basePageProps(props);
    return render(
        <SidebarProvider>
            <AppSidebar user={user} />
        </SidebarProvider>
    );
}

describe('AppSidebar', () => {
    beforeEach(() => {
        pageUrl = '/projects';
    });

    it('renders the static base navigation entries', () => {
        renderSidebar();

        expect(screen.getByText('Create')).toBeInTheDocument();
        expect(screen.getByText('Projects')).toBeInTheDocument();
        expect(screen.getByText('All Projects')).toBeInTheDocument();
        expect(screen.getByText('Billing')).toBeInTheDocument();
        expect(screen.getByText('Support')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it.each([
        ['fileStorageEnabled', 'File Manager', '/file-manager'],
        ['databaseEnabled', 'Databases', '/databases'],
        ['canUseGithub', 'GitHub', '/github'],
        ['canConnectShopify', 'Shopify', '/shopify'],
        ['canUseApi', 'API Keys', '/api-keys'],
    ] as const)('gates the %s entry ("%s") on its capability prop', (propKey, label, href) => {
        // Disabled: entry absent.
        renderSidebar(baseUser, { [propKey]: false });
        expect(screen.queryByText(label)).not.toBeInTheDocument();

        // Enabled: entry present and links to the expected route.
        renderSidebar(baseUser, { [propKey]: true });
        const link = screen.getByText(label).closest('a');
        expect(link).toHaveAttribute('href', href);
    });

    it('also gates the API Docs entry alongside API Keys when canUseApi is true', () => {
        renderSidebar(baseUser, { canUseApi: false });
        expect(screen.queryByText('API Docs')).not.toBeInTheDocument();

        renderSidebar(baseUser, { canUseApi: true });
        const link = screen.getByText('API Docs').closest('a');
        expect(link).toHaveAttribute('href', '/api-docs');
    });

    it('renders recent projects with links to their editor route when present', () => {
        renderSidebar(baseUser, {
            recentProjects: [
                { id: 'proj-1', name: 'Bakery Site' },
                { id: 'proj-2', name: 'Portfolio' },
            ],
        });

        expect(screen.getByText('Recent')).toBeInTheDocument();

        const bakeryLink = screen.getByText('Bakery Site').closest('a');
        expect(bakeryLink).toHaveAttribute('href', '/project/proj-1');

        const portfolioLink = screen.getByText('Portfolio').closest('a');
        expect(portfolioLink).toHaveAttribute('href', '/project/proj-2');
    });

    it('omits the Recent section when there are no recent projects', () => {
        renderSidebar(baseUser, { recentProjects: null });
        expect(screen.queryByText('Recent')).not.toBeInTheDocument();

        renderSidebar(baseUser, { recentProjects: [] });
        expect(screen.queryByText('Recent')).not.toBeInTheDocument();
    });

    it('marks the nav entry matching the current URL as active', () => {
        pageUrl = '/billing/usage';
        renderSidebar();

        const billingLink = screen.getByText('Billing').closest('a');
        const billingButton = billingLink?.closest('[data-sidebar="menu-button"]');
        expect(billingButton).toHaveAttribute('data-active', 'true');

        const settingsLink = screen.getByText('Settings').closest('a');
        const settingsButton = settingsLink?.closest('[data-sidebar="menu-button"]');
        expect(settingsButton).toHaveAttribute('data-active', 'false');
    });

    it('shows the Administration section only for admin users', () => {
        renderSidebar({ ...baseUser, role: 'user' });
        expect(screen.queryByText('Administration')).not.toBeInTheDocument();

        renderSidebar({ ...baseUser, role: 'admin' });
        expect(screen.getByText('Administration')).toBeInTheDocument();
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Users')).toBeInTheDocument();
    });

    it('mounts the sidebar shell inside its SidebarProvider (offcanvas desktop variant)', () => {
        const { container } = renderSidebar();
        expect(container.querySelector('[data-sidebar="sidebar"]')).toBeInTheDocument();
    });
});
