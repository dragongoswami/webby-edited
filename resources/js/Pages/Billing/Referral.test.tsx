import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

let pageProps: Record<string, unknown>;
const routerPost = vi.fn();
const routerGet = vi.fn();

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
    router: {
        post: (...args: unknown[]) => routerPost(...args),
        get: (...args: unknown[]) => routerGet(...args),
        // usePageLoading (used internally by Referral) subscribes to these.
        on: vi.fn(() => vi.fn()),
    },
    Link: ({ children, href, ...props }: { children?: React.ReactNode; href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import ReferralIndex from './Referral';

function setPageProps(overrides: Record<string, unknown> = {}) {
    pageProps = {
        appSettings: { default_currency: 'USD' },
        ...overrides,
    };
}

const auth = { user: { id: 1, name: 'Ada', email: 'ada@example.com' } };

const emptyTransactions = {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
};

describe('Billing/Referral', () => {
    beforeEach(() => {
        routerPost.mockClear();
        routerGet.mockClear();
        setPageProps();
    });

    it('shows the "Generate Referral Link" CTA when the user has no code yet', () => {
        render(
            <ReferralIndex
                auth={auth}
                stats={{ has_code: false, code: null, share_url: null, credit_balance: 0, pending_earnings: 0 }}
                transactions={emptyTransactions}
                referralEnabled={true}
            />
        );

        expect(screen.getByRole('button', { name: 'Generate Referral Link' })).toBeInTheDocument();
    });

    it('disables the button and shows a spinner/label while the generate request is in flight', () => {
        render(
            <ReferralIndex
                auth={auth}
                stats={{ has_code: false, code: null, share_url: null, credit_balance: 0, pending_earnings: 0 }}
                transactions={emptyTransactions}
                referralEnabled={true}
            />
        );

        const button = screen.getByRole('button', { name: 'Generate Referral Link' });
        fireEvent.click(button);

        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url] = routerPost.mock.calls[0];
        expect(url).toBe('/referral.generate-code');

        // router.post is mocked and never invokes onFinish, so isGenerating stays
        // true — the button must show the pending label and stay disabled.
        expect(screen.getByRole('button', { name: 'Generating...' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled();
    });

    it('shows the referral link input (not the generate CTA) once a code exists', () => {
        render(
            <ReferralIndex
                auth={auth}
                stats={{ has_code: true, code: 'ABC123', share_url: 'https://example.com/r/ABC123', credit_balance: 0, pending_earnings: 0 }}
                transactions={emptyTransactions}
                referralEnabled={true}
            />
        );

        expect(screen.queryByRole('button', { name: 'Generate Referral Link' })).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('https://example.com/r/ABC123')).toBeInTheDocument();
    });

    it('the copy-link button has an accessible name that toggles to "Copied!" after clicking', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

        render(
            <ReferralIndex
                auth={auth}
                stats={{ has_code: true, code: 'ABC123', share_url: 'https://example.com/r/ABC123', credit_balance: 0, pending_earnings: 0 }}
                transactions={emptyTransactions}
                referralEnabled={true}
            />
        );

        const copyButton = screen.getByRole('button', { name: 'Copy' });
        fireEvent.click(copyButton);

        await waitFor(() => expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument());
    });
});
