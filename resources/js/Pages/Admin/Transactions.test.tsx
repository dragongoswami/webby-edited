import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Transaction, TransactionFilters, TransactionStats, PaginatedResponse } from '@/types/billing';

// Radix AlertDialog/Select need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

const routerGet = vi.fn();
const routerPost = vi.fn();
const routerVisit = vi.fn();

vi.mock('@inertiajs/react', () => ({
    router: {
        get: (...args: unknown[]) => routerGet(...args),
        post: (...args: unknown[]) => routerPost(...args),
        visit: (...args: unknown[]) => routerVisit(...args),
        // useAdminLoading (used internally by Transactions) subscribes to these.
        on: vi.fn(() => vi.fn()),
    },
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/date', () => ({
    useAppDate: () => ({
        formatDate: (value: string | null | undefined) => value ?? '-',
        formatDateTime: (value: string | null | undefined) => value ?? '-',
        formatRelativeTime: (value: string | null | undefined) => value ?? '-',
    }),
}));

// The global `route()` helper is stubbed by the test setup to ignore params
// (`/${name}`), which would hide a bug where the wrong id is passed. Replace
// it here with a spy that embeds the param so we can assert on the real URL.
const routeSpy = vi.fn((name: string, param?: string | number) =>
    param !== undefined ? `/${name}/${param}` : `/${name}`
);
(globalThis as unknown as { route: typeof routeSpy }).route = routeSpy;

import Transactions from './Transactions';

const currentAdmin = {
    id: 1,
    name: 'Current Admin',
    email: 'admin@example.com',
} as never;

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
    return {
        id: 20,
        transaction_id: 'TXN-20',
        external_transaction_id: null,
        user_id: 2,
        subscription_id: 1,
        amount: 29,
        currency: 'USD',
        status: 'pending',
        type: 'subscription_new',
        payment_method: 'bank_transfer',
        transaction_date: '2026-01-05T00:00:00Z',
        metadata: null,
        processed_by: null,
        notes: null,
        created_at: '2026-01-05T00:00:00Z',
        updated_at: '2026-01-05T00:00:00Z',
        user: { id: 2, name: 'Jane Doe', email: 'jane@example.com' } as never,
        ...overrides,
    };
}

function makePagination(
    data: Transaction[],
    overrides: Partial<PaginatedResponse<Transaction>> = {}
): PaginatedResponse<Transaction> {
    return {
        data,
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: data.length,
        from: data.length ? 1 : null,
        to: data.length || null,
        links: { first: '', last: '', prev: null, next: null },
        ...overrides,
    };
}

const stats: TransactionStats = {
    total_revenue: 0,
    this_month: 0,
    pending_count: 0,
    pending_amount: 0,
    total_transactions: 0,
    refunded: 0,
};

function renderPage(
    transactionsList: Transaction[],
    pagination = makePagination(transactionsList),
    filters: TransactionFilters = {}
) {
    return render(
        <Transactions
            auth={{ user: currentAdmin }}
            transactions={pagination}
            stats={stats}
            filters={filters}
        />
    );
}

describe('Admin/Transactions', () => {
    beforeEach(() => {
        routerGet.mockClear();
        routerPost.mockClear();
        routerVisit.mockClear();
        routeSpy.mockClear();
    });

    it('renders transaction rows with user, amount, status, and method from props', () => {
        renderPage([
            makeTransaction({
                id: 20,
                user: { id: 2, name: 'Jane Doe', email: 'jane@example.com' } as never,
                status: 'pending',
                payment_method: 'bank_transfer',
            }),
        ]);

        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('jane@example.com')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Bank Transfer')).toBeInTheDocument();
    });

    it('Reject: opens an AlertDialog confirm (not window.confirm) and requires a reason before submitting', () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        renderPage([makeTransaction({ id: 21, status: 'pending' })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Reject' }));

        expect(confirmSpy).not.toHaveBeenCalled();
        const dialog = screen.getByRole('alertdialog');
        expect(within(dialog).getByText('Reject this payment. The associated subscription will be cancelled.')).toBeInTheDocument();

        const rejectButton = within(dialog).getByRole('button', { name: 'Reject Payment' });
        expect(rejectButton).toBeDisabled();

        fireEvent.change(within(dialog).getByLabelText('Reason'), {
            target: { value: 'Insufficient proof of payment' },
        });
        expect(rejectButton).not.toBeDisabled();

        fireEvent.click(rejectButton);

        expect(routeSpy).toHaveBeenCalledWith('admin.transactions.reject', 21);
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.transactions.reject/21');
        expect(data).toEqual({ reason: 'Insufficient proof of payment' });
    });

    it('server pagination: clicking next page navigates with the incremented page param', () => {
        renderPage(
            [makeTransaction()],
            makePagination([makeTransaction()], { current_page: 1, last_page: 3, per_page: 10, total: 25 })
        );

        fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.transactions');
        expect(routerGet).toHaveBeenCalledTimes(1);
        const [url, params] = routerGet.mock.calls[0];
        expect(url).toBe('/admin.transactions');
        expect(params).toEqual({ page: 2 });
    });
});
