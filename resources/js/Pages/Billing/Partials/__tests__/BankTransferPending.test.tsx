import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import BankTransferPending from '../BankTransferPending';
import type { Subscription } from '@/types/billing';
import { formatCurrency } from '@/lib/currency';

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: { appSettings: { default_currency: 'USD' } } }),
}));

const makeSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
    id: 1,
    user_id: 1,
    plan_id: 1,
    status: 'pending',
    amount: 49,
    payment_method: 'bank_transfer',
    external_subscription_id: 'REF-12345',
    billing_info: null,
    approved_by: null,
    approved_at: null,
    admin_notes: null,
    payment_proof: null,
    starts_at: null,
    renewal_at: null,
    ends_at: null,
    cancelled_at: null,
    metadata: { instructions: 'Wire to IBAN ...' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    plan: { name: 'Pro' } as Subscription['plan'],
    ...overrides,
});

// The reference "Copy" button is icon-only (no accessible name), so it's
// located by its lucide-copy svg, mirroring the ShareDialog test idiom.
const getReferenceCopyButton = () =>
    document.querySelector('svg.lucide-copy')!.closest('button') as HTMLElement;

describe('BankTransferPending', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    });

    it('renders pending card with plan, amount, and reference', () => {
        const { rerender } = render(<BankTransferPending subscription={makeSubscription()} />);

        expect(screen.getByText('Payment Pending')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText(formatCurrency(49, 'USD', 'en'))).toBeInTheDocument();
        expect(screen.getByText('REF-12345')).toBeInTheDocument();

        rerender(<BankTransferPending subscription={makeSubscription({ plan: null })} />);
        expect(screen.getByText('Unknown Plan')).toBeInTheDocument();
    });

    it('shows the instructions section only when present', () => {
        const { rerender } = render(<BankTransferPending subscription={makeSubscription()} />);
        expect(screen.getByText('Wire to IBAN ...')).toBeInTheDocument();
        expect(screen.getByText('Transfer Details')).toBeInTheDocument();

        rerender(<BankTransferPending subscription={makeSubscription({ metadata: {} })} />);
        expect(screen.queryByText('Wire to IBAN ...')).not.toBeInTheDocument();
        expect(screen.queryByText('Transfer Details')).not.toBeInTheDocument();

        rerender(<BankTransferPending subscription={makeSubscription({ metadata: undefined })} />);
        expect(screen.queryByText('Wire to IBAN ...')).not.toBeInTheDocument();
        expect(screen.queryByText('Transfer Details')).not.toBeInTheDocument();
    });

    it('copies the reference via the secure clipboard API', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

        render(<BankTransferPending subscription={makeSubscription()} />);

        fireEvent.click(getReferenceCopyButton());

        await waitFor(() => expect(writeText).toHaveBeenCalledWith('REF-12345'));
        expect(document.querySelector('svg.lucide-check')).toBeInTheDocument();
    });

    it('sizes the reference copy button at the h-8 w-8 touch-target floor with an accessible name', () => {
        render(<BankTransferPending subscription={makeSubscription()} />);

        const copyButton = getReferenceCopyButton();
        expect(copyButton).toHaveAccessibleName('Copy');
        expect(copyButton.className).toContain('h-8');
        expect(copyButton.className).toContain('w-8');
    });

    it('falls back to execCommand when clipboard API is unavailable', async () => {
        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        const execCommand = vi.fn().mockReturnValue(true);
        document.execCommand = execCommand;

        render(<BankTransferPending subscription={makeSubscription()} />);

        fireEvent.click(getReferenceCopyButton());

        await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'));
        expect(document.querySelector('textarea')).not.toBeInTheDocument();
    });
});
