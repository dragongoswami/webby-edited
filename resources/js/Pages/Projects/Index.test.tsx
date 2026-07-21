import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockIsLoading = false;
vi.mock('@/hooks/usePageLoading', () => ({
    usePageLoading: () => ({
        isLoading: mockIsLoading,
        isRefreshing: false,
        startRefresh: vi.fn(),
        endRefresh: vi.fn(),
    }),
}));
vi.mock('@inertiajs/react', async () => ({
    ...(await vi.importActual<typeof import('@inertiajs/react')>('@inertiajs/react')),
    Head: () => null,
}));
vi.mock('@/components/Sidebar/AppSidebar', () => ({ AppSidebar: () => null }));
vi.mock('@/components/Header/AppPageHeader', () => ({ AppPageHeader: () => null }));

import Index from './Index';

const baseProps = {
    auth: { user: { id: 1, name: 'A', email: 'a@b.c' } },
    projects: {
        data: [
            { id: 'p1', name: 'My Cool Site', updated_at: new Date().toISOString(), is_starred: false, build_status: 'idle' },
        ],
        current_page: 1,
        last_page: 1,
    },
    counts: { all: 1, favorites: 0, trash: 0 },
    activeTab: 'all',
    filters: { search: '', sort: 'last-edited', visibility: null },
    baseDomain: 'example.com',
} as unknown as Parameters<typeof Index>[0];

describe('Projects/Index loading behaviour (#4)', () => {
    beforeEach(() => { mockIsLoading = false; });

    it('keeps the search input mounted while loading', () => {
        mockIsLoading = true;
        render(<Index {...baseProps} />);
        expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
    });

    it('hides project cards while loading (grid shows skeleton instead)', () => {
        mockIsLoading = true;
        render(<Index {...baseProps} />);
        expect(screen.queryByText('My Cool Site')).not.toBeInTheDocument();
    });

    it('shows project cards when not loading', () => {
        mockIsLoading = false;
        render(<Index {...baseProps} />);
        expect(screen.getByText('My Cool Site')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
    });
});

describe('Projects/Index New Project button (FR-000082)', () => {
    beforeEach(() => { mockIsLoading = false; });

    it('renders a header "New Project" link pointing to /create even when projects exist', () => {
        render(<Index {...baseProps} />);
        const link = screen.getByRole('link', { name: 'New Project' });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/create');
    });
});

describe('Projects/Index card action-menu touch-visible reveal (mobile fixes Task 12)', () => {
    beforeEach(() => { mockIsLoading = false; });

    it('the card action-menu trigger is touch-visible (opaque on mobile, hover-revealed on desktop)', () => {
        const { container } = render(<Index {...baseProps} />);
        const trigger = container.querySelector('button[aria-haspopup="menu"]');
        expect(trigger).toBeInTheDocument();
        expect(trigger?.className).toContain('opacity-100');
        expect(trigger?.className).toContain('md:opacity-0');
        expect(trigger?.className).toContain('md:group-hover:opacity-100');
        expect(trigger?.className).toContain('group-focus-within:opacity-100');
    });

    it('uses the semantic warning token (not text-yellow-500) for the starred indicator', () => {
        const starredProps = {
            ...baseProps,
            projects: {
                ...baseProps.projects,
                data: [
                    { id: 'p1', name: 'Starred Site', updated_at: new Date().toISOString(), is_starred: true, build_status: 'idle' },
                ],
            },
        } as unknown as Parameters<typeof Index>[0];

        const { container } = render(<Index {...starredProps} />);
        const star = container.querySelector('svg.lucide-star.absolute');
        expect(star).toBeInTheDocument();
        expect(star?.getAttribute('class')).toContain('text-warning');
        expect(star?.getAttribute('class')).toContain('fill-warning');
        expect(star?.getAttribute('class')).not.toContain('text-yellow-500');
        expect(star?.getAttribute('class')).not.toContain('fill-yellow-500');
    });
});
