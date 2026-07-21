import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Radix Dialog needs these, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const plans = [
    { id: 1, name: 'Free' },
    { id: 2, name: 'Pro' },
];

const template = {
    id: 1,
    slug: 'landing',
    name: 'Landing Page',
    description: 'A landing page template',
    category: 'landing',
    version: '1.0.0',
    thumbnail: null,
    is_system: false,
    zip_path: '/templates/landing.zip',
    output_target: 'website' as const,
    metadata: null,
    plans,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

const templates = {
    data: [template],
    current_page: 1,
    from: 1,
    last_page: 1,
    links: [],
    per_page: 10,
    to: 1,
    total: 1,
};

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    router: {
        get: vi.fn(),
        delete: vi.fn(),
        on: vi.fn(() => vi.fn()),
    },
    usePage: () => ({
        props: {
            templates,
            plans,
            auth: { user: { id: 1, name: 'Admin' } },
            wordpressEnabled: true,
            shopifyEnabled: false,
            filters: {},
        },
    }),
    useForm: (initial: Record<string, unknown>) => ({
        data: initial,
        setData: vi.fn(),
        post: vi.fn(),
        processing: false,
        errors: {},
        reset: vi.fn(),
    }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Index from './Index';

describe('Admin/Templates/Index', () => {
    it('Add Template dialog: plan-checkbox grid is responsive (stacks on mobile, 2-col from sm)', () => {
        render(<Index />);

        fireEvent.click(screen.getByRole('button', { name: 'Add Template' }));

        const dialog = screen.getByRole('dialog');
        const proLabel = within(dialog).getByText('Pro');
        const grid = proLabel.closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('Edit Template dialog: plan-checkbox grid is responsive (stacks on mobile, 2-col from sm)', () => {
        render(<Index />);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

        const dialog = screen.getByRole('dialog');
        const proLabel = within(dialog).getByText('Pro');
        const grid = proLabel.closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('filter toolbar wraps on mobile (stacked column, row from sm)', () => {
        render(<Index />);

        const searchInput = screen.getByPlaceholderText('Search templates...');
        let ancestor: HTMLElement | null = searchInput.parentElement;
        while (ancestor && !(ancestor.classList.contains('flex-col') && ancestor.classList.contains('sm:flex-row'))) {
            ancestor = ancestor.parentElement;
        }

        expect(ancestor).not.toBeNull();
        expect(ancestor).toHaveClass('flex-col');
        expect(ancestor).toHaveClass('sm:flex-row');
    });

    it('search input is full-width on mobile, fixed width from sm', () => {
        render(<Index />);

        const searchInput = screen.getByPlaceholderText('Search templates...');

        expect(searchInput).toHaveClass('w-full');
        expect(searchInput).toHaveClass('sm:w-[300px]');
    });

    it('output-type select is full-width on mobile, fixed width from sm', () => {
        render(<Index />);

        const outputTrigger = screen.getByText('All output types').closest('button');

        expect(outputTrigger).toHaveClass('w-full');
        expect(outputTrigger).toHaveClass('sm:w-[180px]');
    });
});
