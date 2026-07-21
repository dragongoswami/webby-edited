import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@inertiajs/react', () => ({
    Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
        <a {...props}>{children}</a>
    ),
    router: {
        get: vi.fn(),
        post: vi.fn(),
        on: vi.fn(() => vi.fn()),
    },
    usePage: () => ({
        props: {
            auth: { user: { id: 1, name: 'Admin' } },
            appSettings: {},
        },
    }),
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/Admin/TanStackDataTable', () => ({
    TanStackDataTable: () => <div data-testid="data-table" />,
}));

import SupportIndex from '../Index';

const tickets = {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
};

describe('Support/Index', () => {
    it('status-filter pill row wraps on narrow viewports', () => {
        render(
            <SupportIndex
                tickets={tickets}
                filter="all"
                planEnabled
                openLimit={null}
                openCount={0}
                projects={[]}
            />,
        );

        const nav = screen.getByRole('navigation');
        expect(nav).toHaveClass('flex-wrap');
    });

    it('exposes the open-ticket-limit reason via aria-describedby instead of a title attribute', () => {
        render(
            <SupportIndex
                tickets={tickets}
                filter="all"
                planEnabled
                openLimit={1}
                openCount={1}
                projects={[]}
            />,
        );

        const newTicketButton = screen.getByRole('button', { name: 'New ticket' });
        expect(newTicketButton).toBeDisabled();
        expect(newTicketButton).not.toHaveAttribute('title');

        const describedById = newTicketButton.getAttribute('aria-describedby');
        expect(describedById).toBeTruthy();

        const reasonNode = document.getElementById(describedById!);
        expect(reasonNode).not.toBeNull();
        expect(reasonNode).toHaveClass('sr-only');
        expect(reasonNode).toHaveTextContent('Open ticket limit reached');
    });
});
