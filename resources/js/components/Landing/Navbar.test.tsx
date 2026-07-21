import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (returns the key as translation). Its useLanguage() returns availableLanguages: []
// so LanguageSelector (used inside Navbar) renders null and never needs its own mock.

let pageProps: Record<string, unknown> = { appSettings: {} };

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
    Link: ({ children, href, ...props }: { children?: ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

// Navbar renders ApplicationLogo + ThemeToggle, both of which need ThemeContext.
vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({ resolvedTheme: 'light', theme: 'light', setTheme: vi.fn() }),
}));

import { Navbar } from './Navbar';

function setScrollY(value: number) {
    Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true });
}

describe('Navbar', () => {
    beforeEach(() => {
        pageProps = { appSettings: {} };
        setScrollY(0);
        Element.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        document.body.querySelectorAll('#features, #pricing, #use-cases').forEach((el) => el.remove());
    });

    it('renders the brand logo and nav links for the default (all-enabled) sections', () => {
        render(<Navbar auth={{ user: null }} canLogin canRegister />);

        expect(screen.getByText('App')).toBeInTheDocument(); // ApplicationLogo fallback site name
        expect(screen.getByText('Features')).toBeInTheDocument();
        expect(screen.getByText('Pricing')).toBeInTheDocument();
        expect(screen.getByText('Use Cases')).toBeInTheDocument();
    });

    describe('enabledSectionTypes filtering', () => {
        it('shows only the matching link when a single section type is enabled', () => {
            render(<Navbar auth={{ user: null }} canLogin canRegister enabledSectionTypes={['features']} />);

            expect(screen.getByText('Features')).toBeInTheDocument();
            expect(screen.queryByText('Pricing')).not.toBeInTheDocument();
            expect(screen.queryByText('Use Cases')).not.toBeInTheDocument();
        });

        it('shows all links when enabledSectionTypes is an empty array (backwards-compat default)', () => {
            render(<Navbar auth={{ user: null }} canLogin canRegister enabledSectionTypes={[]} />);

            expect(screen.getByText('Features')).toBeInTheDocument();
            expect(screen.getByText('Pricing')).toBeInTheDocument();
            expect(screen.getByText('Use Cases')).toBeInTheDocument();
        });

        it('shows all links when every section type is enabled', () => {
            render(
                <Navbar
                    auth={{ user: null }}
                    canLogin
                    canRegister
                    enabledSectionTypes={['features', 'pricing', 'use_cases']}
                />
            );

            expect(screen.getByText('Features')).toBeInTheDocument();
            expect(screen.getByText('Pricing')).toBeInTheDocument();
            expect(screen.getByText('Use Cases')).toBeInTheDocument();
        });
    });

    describe('auth-gated CTAs', () => {
        it('shows a Dashboard link (to /create) and hides Login/Register when the user is logged in', () => {
            render(
                <Navbar
                    auth={{ user: { id: 1, name: 'Ada', email: 'ada@example.com' } }}
                    canLogin
                    canRegister
                />
            );

            const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
            expect(dashboardLink).toHaveAttribute('href', '/create');
            expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'Get started' })).not.toBeInTheDocument();
        });

        it('shows Login and Register links for a guest when both are allowed', () => {
            render(<Navbar auth={{ user: null }} canLogin canRegister />);

            expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
            expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
            expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
        });

        it('hides Register when canRegister is false', () => {
            render(<Navbar auth={{ user: null }} canLogin canRegister={false} />);

            expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'Get started' })).not.toBeInTheDocument();
        });

        it('hides Login when canLogin is false', () => {
            render(<Navbar auth={{ user: null }} canLogin={false} canRegister />);

            expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'Get started' })).toBeInTheDocument();
        });
    });

    it('toggles the mobile menu open and closed', async () => {
        render(<Navbar auth={{ user: null }} canLogin canRegister />);

        // Closed by default: Radix Dialog doesn't mount SheetContent, so only the
        // desktop nav has a "Features" link.
        expect(screen.getAllByText('Features')).toHaveLength(1);

        const toggleButton = screen.getByRole('button', { name: 'Toggle menu' });
        fireEvent.click(toggleButton);

        // Open: the mobile panel duplicates the nav links.
        expect(await screen.findAllByText('Features')).toHaveLength(2);

        const closeButton = screen.getByRole('button', { name: 'Close' });
        fireEvent.click(closeButton);

        expect(screen.getAllByText('Features')).toHaveLength(1);
    });

    it('applies the scrolled classes once window.scrollY passes 50, and removes them at 0', () => {
        const { container } = render(<Navbar auth={{ user: null }} canLogin canRegister />);
        const header = container.querySelector('header') as HTMLElement;

        expect(header).toHaveClass('bg-transparent');
        expect(header).not.toHaveClass('shadow-sm');

        act(() => {
            setScrollY(100);
            window.dispatchEvent(new Event('scroll'));
        });

        expect(header).toHaveClass('bg-background/80', 'backdrop-blur-md', 'border-b', 'border-border', 'shadow-sm');
        expect(header).not.toHaveClass('bg-transparent');

        act(() => {
            setScrollY(0);
            window.dispatchEvent(new Event('scroll'));
        });

        expect(header).toHaveClass('bg-transparent');
        expect(header).not.toHaveClass('shadow-sm');
    });

    it('removes the scroll listener on unmount', () => {
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        const { unmount } = render(<Navbar auth={{ user: null }} canLogin canRegister />);

        unmount();

        expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
        removeSpy.mockRestore();
    });

    it('smooth-scrolls to the target section and prevents default navigation on anchor click', () => {
        const target = document.createElement('div');
        target.id = 'features';
        document.body.appendChild(target);

        render(<Navbar auth={{ user: null }} canLogin canRegister />);

        const link = screen.getByText('Features').closest('a') as HTMLAnchorElement;
        expect(link).toHaveAttribute('href', '#features');

        const notCancelled = fireEvent.click(link);

        expect(notCancelled).toBe(false); // fireEvent returns false when preventDefault() was called
        expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('offsets the header below the announcement bar when announcementOffset is true', () => {
        const { container, rerender } = render(
            <Navbar auth={{ user: null }} canLogin canRegister announcementOffset={false} />
        );
        expect(container.querySelector('header')).toHaveClass('top-0');
        expect(container.querySelector('header')).not.toHaveClass('top-10');

        rerender(<Navbar auth={{ user: null }} canLogin canRegister announcementOffset />);

        expect(container.querySelector('header')).toHaveClass('top-10');
        expect(container.querySelector('header')).not.toHaveClass('top-0');
    });
});
