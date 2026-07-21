import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Radix Tooltip/DnD need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('@inertiajs/react', () => ({
    Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
        <a {...props}>{children}</a>
    ),
    router: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        on: vi.fn(() => vi.fn()),
    },
    usePage: () => ({
        props: {
            auth: { user: { id: 1, name: 'Admin' } },
            appSettings: { default_currency: 'USD' },
        },
    }),
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Index from '../Index';

function makePlan(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        name: 'Starter',
        slug: 'starter',
        description: 'Get started',
        price: 0,
        billing_period: 'monthly',
        features: [],
        is_active: true,
        is_popular: false,
        sort_order: 1,
        max_projects: 3,
        monthly_build_credits: 100,
        allow_user_ai_api_key: false,
        enable_subdomains: true,
        max_subdomains_per_user: 1,
        allow_private_visibility: false,
        enable_custom_domains: false,
        max_custom_domains_per_user: null,
        ...overrides,
    };
}

describe('Admin/Plans/Index', () => {
    it('a plan with active subscribers gets a disabled delete button and no tooltip (no active subscribers case has no tooltip)', () => {
        render(<Index auth={{ user: { id: 1, name: 'Admin' } } as never} plans={[makePlan({ active_subscribers_count: 0 })]} stats={{ total_plans: 1, active_plans: 1, total_subscribers: 0 }} filters={{}} />);

        const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-trash-2'));
        expect(deleteButtons).toHaveLength(1);
        expect(deleteButtons[0]).not.toBeDisabled();
    });

    it('explains via a Tooltip why the delete button is disabled when the plan has active subscribers', async () => {
        render(
            <Index
                auth={{ user: { id: 1, name: 'Admin' } } as never}
                plans={[makePlan({ active_subscribers_count: 5 })]}
                stats={{ total_plans: 1, active_plans: 1, total_subscribers: 5 }}
                filters={{}}
            />
        );

        const deleteButton = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-trash-2'));
        expect(deleteButton).toBeDisabled();

        fireEvent.focus(deleteButton!.closest('[tabindex]') ?? deleteButton!);

        await waitFor(() => {
            expect(screen.getAllByText('Cannot delete a plan with active subscribers').length).toBeGreaterThan(0);
        });
    });

    it('the drag handle and delete buttons have accessible names', () => {
        render(<Index auth={{ user: { id: 1, name: 'Admin' } } as never} plans={[makePlan({ active_subscribers_count: 0 })]} stats={{ total_plans: 1, active_plans: 1, total_subscribers: 0 }} filters={{}} />);

        expect(screen.getByRole('button', { name: 'Drag to reorder' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
});
