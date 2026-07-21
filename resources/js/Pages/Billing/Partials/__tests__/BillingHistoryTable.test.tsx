import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import BillingHistoryTable from '../BillingHistoryTable';
import type { Transaction, PaginatedResponse } from '@/types/billing';

// useAppDate reads Inertia's usePage(), which isn't wired up in this render tree.
// A passthrough formatter keeps assertions about *content presence* honest
// without pulling in an Inertia page-props mock unrelated to this component's behavior.
vi.mock('@/lib/date', () => ({
    useAppDate: () => ({
        formatDate: (value: string | null | undefined) => value ?? '-',
    }),
}));

// Radix/TanStack controls need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

beforeEach(() => {
    // The actions column links to billing.invoice, and pagination navigates via
    // billing.index — give both routes real-looking targets.
    (globalThis as { route: (name: string, params?: unknown) => string }).route = (name, params) =>
        name === 'billing.invoice' ? '/billing/invoice/' + params : '/billing';
});

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 1,
    transaction_id: 'txn_1',
    external_transaction_id: null,
    user_id: 1,
    subscription_id: null,
    amount: 20,
    currency: 'USD',
    status: 'completed',
    type: 'subscription_new',
    payment_method: 'paypal',
    transaction_date: '2026-01-01T00:00:00Z',
    metadata: null,
    processed_by: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
});

const makePage = (data: Transaction[]): PaginatedResponse<Transaction> => ({
    data,
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: data.length,
    from: data.length ? 1 : null,
    to: data.length,
    links: {
        first: '/billing?page=1',
        last: '/billing?page=1',
        prev: null,
        next: null,
    },
});

describe('BillingHistoryTable', () => {
    it('renders empty state when no transactions', () => {
        render(<BillingHistoryTable transactions={makePage([])} />);

        expect(screen.getByText('No billing history')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders the #INV invoice number format', () => {
        render(
            <BillingHistoryTable
                transactions={makePage([makeTransaction({ id: 42, created_at: '2026-03-15T00:00:00Z' })])}
            />
        );

        expect(screen.getByText('#INV-2026-00042')).toBeInTheDocument();
    });

    it('shows a negative-styled amount for a refund and a plain amount for a regular charge', () => {
        render(
            <BillingHistoryTable
                transactions={makePage([
                    makeTransaction({ id: 1, type: 'refund', amount: 10, currency: 'USD' }),
                    makeTransaction({ id: 2, type: 'subscription_new', amount: 20, currency: 'USD' }),
                ])}
            />
        );

        expect(screen.getByText('-$10.00')).toBeInTheDocument();
        expect(screen.getByText('$20.00')).toBeInTheDocument();
    });

    it('maps known payment methods and falls back to the raw value', () => {
        render(
            <BillingHistoryTable
                transactions={makePage([
                    makeTransaction({ id: 1, payment_method: 'paypal' }),
                    makeTransaction({ id: 2, payment_method: 'some_gateway' as Transaction['payment_method'] }),
                ])}
            />
        );

        expect(screen.getByText('PayPal')).toBeInTheDocument();
        expect(screen.getByText('some_gateway')).toBeInTheDocument();
    });

    it('shows an invoice View link only for completed transactions', () => {
        render(
            <BillingHistoryTable
                transactions={makePage([
                    makeTransaction({ id: 1, status: 'completed' }),
                    makeTransaction({ id: 2, status: 'pending' }),
                ])}
            />
        );

        const viewLinks = screen.getAllByRole('link', { name: /View/ });
        expect(viewLinks).toHaveLength(1);
        expect(viewLinks[0]).toHaveAttribute('href', '/billing/invoice/1');
    });
});
