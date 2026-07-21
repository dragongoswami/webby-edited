import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import BuyCreditsDialog from '../BuyCreditsDialog';
import type { CreditPack, CreditPackGateway } from '@/types/billing';

// Radix Dialog/RadioGroup need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

let pageProps: Record<string, unknown>;
const routerPost = vi.fn();

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
    router: { post: (...args: unknown[]) => routerPost(...args) },
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
    toast: { error: (...args: unknown[]) => toastError(...args) },
}));

const packs: CreditPack[] = [
    {
        id: 1,
        name: 'Starter',
        description: null,
        credits: 1000,
        bonus_credits: 0,
        price: 9.99,
        currency: 'USD',
        is_popular: false,
    },
    {
        id: 2,
        name: 'Growth',
        description: 'Great value for growing projects',
        credits: 5000,
        bonus_credits: 500,
        price: 19.99,
        currency: 'USD',
        is_popular: true,
    },
    {
        id: 3,
        name: 'Pro',
        description: null,
        credits: 10000,
        bonus_credits: 0,
        price: 39.99,
        currency: 'USD',
        is_popular: false,
    },
];

const gateways: CreditPackGateway[] = [
    { slug: 'paypal', name: 'PayPal', requires_manual_approval: false },
    { slug: 'bank_transfer', name: 'Bank Transfer', requires_manual_approval: true },
];

type Overrides = Record<string, unknown>;

function baseProps(overrides: Overrides = {}) {
    return {
        open: true,
        onOpenChange: vi.fn(),
        packs,
        gateways,
        ...overrides,
    };
}

describe('BuyCreditsDialog', () => {
    beforeEach(() => {
        pageProps = { flash: {} };
        routerPost.mockClear();
        toastError.mockClear();
    });

    it('renders the pack list and gateways, including the popular badge', () => {
        render(<BuyCreditsDialog {...baseProps()} />);

        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('Growth')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();

        expect(screen.getByText('$9.99')).toBeInTheDocument();
        expect(screen.getByText('$19.99')).toBeInTheDocument();
        expect(screen.getByText('$39.99')).toBeInTheDocument();

        expect(screen.getByText('1,000 tokens')).toBeInTheDocument();
        expect(screen.getByText('5,000 tokens')).toBeInTheDocument();
        expect(screen.getByText('10,000 tokens')).toBeInTheDocument();

        // Only the Growth pack is popular.
        expect(screen.getByText('Popular')).toBeInTheDocument();

        expect(screen.getByText('PayPal')).toBeInTheDocument();
        expect(screen.getByText('Bank Transfer')).toBeInTheDocument();
        expect(screen.getByText('Manual approval')).toBeInTheDocument();
    });

    it('keeps Buy disabled until both a pack and a gateway are selected', () => {
        render(<BuyCreditsDialog {...baseProps()} />);

        const buyButton = screen.getByRole('button', { name: 'Buy' });
        expect(buyButton).toBeDisabled();

        const radios = screen.getAllByRole('radio');
        fireEvent.click(radios[0]);
        expect(buyButton).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'PayPal' }));
        expect(buyButton).not.toBeDisabled();
    });

    it('does not call router.post when Buy is clicked with nothing selected', () => {
        render(<BuyCreditsDialog {...baseProps()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Buy' }));

        expect(routerPost).not.toHaveBeenCalled();
    });

    it('submits the selected pack + gateway, showing a spinner while in-flight and re-enabling on finish', () => {
        render(<BuyCreditsDialog {...baseProps()} />);

        const radios = screen.getAllByRole('radio');
        fireEvent.click(radios[1]); // Growth (id 2)
        fireEvent.click(screen.getByRole('button', { name: 'PayPal' }));

        fireEvent.click(screen.getByRole('button', { name: 'Buy' }));

        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data, options] = routerPost.mock.calls[0];
        expect(url).toBe('/credit-packs.purchase');
        expect(data).toEqual({ credit_pack_id: 2, gateway: 'paypal' });
        expect(options).toEqual(
            expect.objectContaining({ preserveScroll: true, preserveState: true })
        );

        // Still in-flight: spinner shown, button disabled.
        expect(screen.getByText('Processing...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Processing/ })).toBeDisabled();

        act(() => {
            options.onFinish();
        });

        expect(screen.getByRole('button', { name: 'Buy' })).not.toBeDisabled();
    });

    it('toasts the first validation error and clears the processing state on onError', () => {
        render(<BuyCreditsDialog {...baseProps()} />);

        const radios = screen.getAllByRole('radio');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: 'PayPal' }));
        fireEvent.click(screen.getByRole('button', { name: 'Buy' }));

        const [, , options] = routerPost.mock.calls[0];

        act(() => {
            options.onError({ credit_pack_id: 'Pack unavailable' });
        });

        expect(toastError).toHaveBeenCalledWith('Pack unavailable');
        expect(screen.getByRole('button', { name: 'Buy' })).not.toBeDisabled();
        expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
    });

    it('switches to the bank-transfer instructions view when flash.bankTransfer arrives', () => {
        pageProps = {
            flash: {
                bankTransfer: {
                    type: 'bank_transfer',
                    reference: 'BT-123',
                    amount: 25,
                    currency: 'USD',
                    pack_name: 'Starter',
                    instructions: 'Pay here',
                },
            },
        };

        render(<BuyCreditsDialog {...baseProps()} />);

        expect(screen.getByText('Bank Transfer Instructions')).toBeInTheDocument();
        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('$25.00')).toBeInTheDocument();
        expect(screen.getByText('BT-123')).toBeInTheDocument();
        expect(screen.getByText('Pay here')).toBeInTheDocument();

        // Pack view content is gone.
        expect(screen.queryByText('Buy Credits')).not.toBeInTheDocument();
    });

    it('stays on the pack view when flash is present but not a bank_transfer type', () => {
        pageProps = {
            flash: {
                bankTransfer: {
                    type: 'something_else',
                    reference: 'BT-999',
                    amount: 10,
                    currency: 'USD',
                    pack_name: '',
                    instructions: 'n/a',
                },
            },
        };

        render(<BuyCreditsDialog {...baseProps()} />);

        expect(screen.getByText('Buy Credits')).toBeInTheDocument();
        expect(screen.queryByText('Bank Transfer Instructions')).not.toBeInTheDocument();
    });

    it('copies instructions via navigator.clipboard on the secure path and shows the copied indicator', async () => {
        pageProps = {
            flash: {
                bankTransfer: {
                    type: 'bank_transfer',
                    reference: 'BT-123',
                    amount: 25,
                    currency: 'USD',
                    pack_name: 'Starter',
                    instructions: 'Pay here',
                },
            },
        };

        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(window.navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });

        render(<BuyCreditsDialog {...baseProps()} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        });

        expect(writeText).toHaveBeenCalledWith('Pay here');
        expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('falls back to document.execCommand when clipboard/secure context is unavailable', async () => {
        pageProps = {
            flash: {
                bankTransfer: {
                    type: 'bank_transfer',
                    reference: 'BT-123',
                    amount: 25,
                    currency: 'USD',
                    pack_name: 'Starter',
                    instructions: 'Pay here',
                },
            },
        };

        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
        Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true });
        const execCommand = vi.fn();
        document.execCommand = execCommand;

        render(<BuyCreditsDialog {...baseProps()} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        });

        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(document.querySelector('textarea')).not.toBeInTheDocument();
        expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('resets state on close (handleClose via the onOpenChange(false) path), reverting to the pack view', () => {
        const onOpenChange = vi.fn();
        pageProps = {
            flash: {
                bankTransfer: {
                    type: 'bank_transfer',
                    reference: 'BT-123',
                    amount: 25,
                    currency: 'USD',
                    pack_name: 'Starter',
                    instructions: 'Pay here',
                },
            },
        };

        render(<BuyCreditsDialog {...baseProps({ onOpenChange })} />);

        expect(screen.getByText('Bank Transfer Instructions')).toBeInTheDocument();

        const closeButtons = screen.getAllByRole('button', { name: 'Close' });
        // The last "Close" is the Radix dialog's built-in X button, which routes
        // through Dialog's onOpenChange(false) -> our handleClose() wrapper.
        fireEvent.click(closeButtons[closeButtons.length - 1]);

        expect(onOpenChange).toHaveBeenCalledWith(false);

        // Internal state (bankTransferData) was cleared by handleClose, and the
        // flash object reference is unchanged so the sync effect won't re-fire:
        // the dialog reverts to the pack-selection view.
        expect(screen.getByText('Buy Credits')).toBeInTheDocument();
        expect(screen.queryByText('Bank Transfer Instructions')).not.toBeInTheDocument();
    });

    it('formats pack prices with the real formatCurrency utility', () => {
        render(<BuyCreditsDialog {...baseProps()} />);

        // 19.99 USD in locale 'en' (from the mocked LanguageContext).
        expect(screen.getByText('$19.99')).toBeInTheDocument();
    });
});
