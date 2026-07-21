import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ImpersonationBanner from '../ImpersonationBanner';

const { routerPost, pageState } = vi.hoisted(() => ({
    routerPost: vi.fn(),
    pageState: {
        props: {
            impersonating: false,
            auth: { user: { name: 'Alice' } },
        } as { impersonating: boolean; auth: { user: { name: string } | null } },
    },
}));

vi.mock('@inertiajs/react', () => ({
    usePage: () => pageState,
    router: { post: (...args: unknown[]) => routerPost(...args) },
}));

beforeEach(() => {
    routerPost.mockClear();
    (globalThis as { route: (name: string) => string }).route = (name: string) => '/' + name;
});

afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-impersonating');
    document.documentElement.style.removeProperty('--impersonation-banner-height');
});

describe('ImpersonationBanner', () => {
    it('renders nothing when not impersonating', () => {
        pageState.props = { impersonating: false, auth: { user: { name: 'Alice' } } };
        render(<ImpersonationBanner />);

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(document.documentElement.hasAttribute('data-impersonating')).toBe(false);
    });

    it('renders the banner with the impersonated name when impersonating', () => {
        pageState.props = { impersonating: true, auth: { user: { name: 'Alice' } } };
        render(<ImpersonationBanner />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('You are impersonating Alice')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Stop Impersonating' })).toBeInTheDocument();
    });

    it('renders fixed to the viewport top so the app.css offset rules (sidebar/sticky headers) stay valid on scroll', () => {
        pageState.props = { impersonating: true, auth: { user: { name: 'Alice' } } };
        render(<ImpersonationBanner />);

        const root = screen.getByRole('alert');
        expect(root).toHaveClass('fixed');
        expect(root).toHaveClass('top-0');
        expect(root).toHaveClass('inset-x-0');
        // Above page content, but BELOW dialogs/alert-dialogs (z-50) so a tall
        // modal's close button can never be covered by the banner strip.
        expect(root).toHaveClass('z-40');
    });

    it('sets the documentElement attribute and CSS var when impersonating', () => {
        pageState.props = { impersonating: true, auth: { user: { name: 'Alice' } } };
        render(<ImpersonationBanner />);

        expect(document.documentElement.getAttribute('data-impersonating')).toBe('');
        expect(document.documentElement.style.getPropertyValue('--impersonation-banner-height')).toBe('52px');
    });

    it('clicking Stop Impersonating posts to impersonate.stop', () => {
        pageState.props = { impersonating: true, auth: { user: { name: 'Alice' } } };
        render(<ImpersonationBanner />);

        fireEvent.click(screen.getByRole('button', { name: /Stop Impersonating/i }));

        expect(routerPost).toHaveBeenCalledWith('/impersonate.stop');
    });

    it('cleans up the documentElement attribute on unmount', () => {
        pageState.props = { impersonating: true, auth: { user: { name: 'Alice' } } };
        const { unmount } = render(<ImpersonationBanner />);

        expect(document.documentElement.hasAttribute('data-impersonating')).toBe(true);

        unmount();

        expect(document.documentElement.hasAttribute('data-impersonating')).toBe(false);
        expect(document.documentElement.style.getPropertyValue('--impersonation-banner-height')).toBe('');
    });
});
