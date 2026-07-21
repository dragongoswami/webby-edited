import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Plan, PaymentGateway } from '@/types/billing';
import { formatCurrency as formatCurrencyUtil } from '@/lib/currency';

// Radix Dialog/Checkbox need these pointer APIs, which jsdom doesn't implement.
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
    router: {
        post: (...args: unknown[]) => routerPost(...args),
        // usePageLoading (used internally by Plans) subscribes to these.
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

import Plans from './Plans';

function makePlan(overrides: Partial<Plan> = {}): Plan {
    return {
        id: 1,
        name: 'Starter',
        slug: 'starter',
        description: 'Get started for free',
        price: '0.00',
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
        enable_file_storage: false,
        max_storage_mb: null,
        max_file_size_mb: 5,
        allowed_file_types: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        ...overrides,
    } as Plan;
}

// price arrives as a decimal:2 string over the wire — mock it honestly
const freePlan = makePlan({ id: 1, name: 'Starter', price: '0.00', billing_period: 'monthly' });
const proPlan = makePlan({
    id: 2,
    name: 'Pro',
    description: 'For professionals',
    price: '29.00',
    billing_period: 'monthly',
    is_popular: true,
    max_projects: 20,
    monthly_build_credits: 5000,
});
const enterprisePlan = makePlan({
    id: 3,
    name: 'Enterprise',
    description: 'For large teams',
    price: '299.00',
    billing_period: 'yearly',
    max_projects: null,
    monthly_build_credits: 50000,
});
const trialPlan = makePlan({
    id: 4,
    name: 'Trial',
    description: 'One-time trial',
    price: 0,
    billing_period: 'lifetime',
    one_time_credits: true,
});

const paypalGateway: PaymentGateway = {
    slug: 'paypal',
    name: 'PayPal',
    description: 'Pay with PayPal',
    icon: 'paypal',
    supports_auto_renewal: true,
    requires_manual_approval: false,
};
const bankGateway: PaymentGateway = {
    slug: 'bank_transfer',
    name: 'Bank Transfer',
    description: 'Manual bank transfer, approved by an admin',
    icon: 'bank',
    supports_auto_renewal: false,
    requires_manual_approval: true,
};

function setPageProps(overrides: Record<string, unknown> = {}) {
    pageProps = {
        auth: { user: { id: 1, name: 'Ada', email: 'ada@example.com' } },
        flash: {},
        appSettings: { default_currency: 'USD' },
        ...overrides,
    };
}

describe('Billing/Plans', () => {
    beforeEach(() => {
        routerPost.mockClear();
        setPageProps();
    });

    it('renders the plans grid with formatted prices and feature lines', () => {
        render(
            <Plans
                plans={[freePlan, proPlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
            />
        );

        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText('For professionals')).toBeInTheDocument();

        // Prices computed with the real currency formatter, USD/en-US.
        expect(screen.getByText(formatCurrencyUtil(0, 'USD', 'en'))).toBeInTheDocument();
        expect(screen.getByText(formatCurrencyUtil(29, 'USD', 'en'))).toBeInTheDocument();

        // Feature list is rendered per-plan (project limits at minimum).
        expect(screen.getByText('20 projects')).toBeInTheDocument();
    });

    it('highlights the current plan with a badge and a disabled "Current Plan" button', () => {
        render(
            <Plans
                plans={[freePlan, proPlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={proPlan.id}
                referralCreditBalance={0}
            />
        );

        // Badge above the Pro card.
        expect(screen.getAllByText('Current Plan').length).toBeGreaterThanOrEqual(2);

        const currentPlanButtons = screen.getAllByRole('button', { name: 'Current Plan' });
        expect(currentPlanButtons.length).toBeGreaterThanOrEqual(1);
        currentPlanButtons.forEach((button) => expect(button).toBeDisabled());

        // Clicking it is a no-op (handlePlanSelect early-returns for the current plan).
        fireEvent.click(currentPlanButtons[currentPlanButtons.length - 1]);
        expect(routerPost).not.toHaveBeenCalled();
    });

    it('clicking Select Plan on a paid plan opens the payment method dialog, and choosing a gateway posts plan_id + gateway', () => {
        render(
            <Plans
                plans={[proPlan]}
                paymentGateways={[paypalGateway, bankGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
            />
        );

        expect(screen.queryByText('Select Payment Method')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Select Plan' }));

        expect(screen.getByText('Select Payment Method')).toBeInTheDocument();
        // Selected-plan summary inside the dialog.
        expect(screen.getAllByText('Pro').length).toBeGreaterThanOrEqual(2);

        fireEvent.click(screen.getByRole('button', { name: /PayPal/ }));

        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/payment.initiate');
        expect(data).toEqual({ plan_id: proPlan.id, gateway: 'paypal' });
    });

    it('selecting a lower-priced plan than the current one goes through the same payment dialog (no separate downgrade confirmation)', () => {
        render(
            <Plans
                plans={[proPlan, enterprisePlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={enterprisePlan.id}
                referralCreditBalance={0}
            />
        );

        // Enterprise is current; Pro is a downgrade but uses the identical "Select Plan" flow.
        fireEvent.click(screen.getByRole('button', { name: 'Select Plan' }));

        expect(screen.getByText('Select Payment Method')).toBeInTheDocument();
        expect(screen.queryByText(/downgrade/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /PayPal/ }));
        const [, data] = routerPost.mock.calls[0];
        expect(data).toEqual({ plan_id: proPlan.id, gateway: 'paypal' });
    });

    it('shows the correct billing-period suffix per plan (monthly vs yearly)', () => {
        render(
            <Plans
                plans={[proPlan, enterprisePlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
            />
        );

        expect(screen.getByText('/month')).toBeInTheDocument();
        expect(screen.getByText('/year')).toBeInTheDocument();
    });

    it('subscribing to a free plan posts directly with gateway "free", skipping the payment dialog', () => {
        render(
            <Plans
                plans={[freePlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Get Started Free' }));

        expect(screen.queryByText('Select Payment Method')).not.toBeInTheDocument();
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/payment.initiate');
        expect(data).toEqual({ plan_id: freePlan.id, gateway: 'free' });
    });

    it('shows the processing spinner on the free-plan button while the subscription request is in flight', () => {
        render(
            <Plans
                plans={[freePlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
            />
        );

        const button = screen.getByRole('button', { name: 'Get Started Free' });
        fireEvent.click(button);

        // router.post is mocked and never invokes onFinish, so isProcessing stays
        // true — the button must now show the spinner/label instead of resetting.
        expect(screen.getByText('Processing...')).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it('pays with referral credits when the balance covers the plan price', () => {
        render(
            <Plans
                plans={[proPlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={100}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select Plan' }));
        fireEvent.click(screen.getByText('Pay with Referral Credits'));
        fireEvent.click(screen.getByRole('button', { name: /Activate with Referral Credits/ }));

        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/payment.initiate');
        expect(data).toEqual({
            plan_id: proPlan.id,
            gateway: 'referral_credits',
            apply_referral_credits: true,
        });
    });

    it('shows an already-used, disabled button for a single-use plan present in usedPlanIds', () => {
        render(
            <Plans
                plans={[trialPlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
                usedPlanIds={[trialPlan.id]}
            />
        );

        const button = screen.getByRole('button', { name: 'Already used' });
        expect(button).toBeDisabled();

        fireEvent.click(button);
        expect(routerPost).not.toHaveBeenCalled();
    });

    it('renders no plan cards, without crashing, when plans is empty', () => {
        render(
            <Plans
                plans={[]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
            />
        );

        expect(screen.getByText('Choose a Plan')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Select Plan' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Get Started Free' })).not.toBeInTheDocument();
    });

    it('formats prices in the currency from appSettings.default_currency, using the real formatter', () => {
        setPageProps({ appSettings: { default_currency: 'JPY' } });

        render(
            <Plans
                plans={[proPlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
            />
        );

        // JPY is zero-decimal — matches the real lib's output exactly.
        expect(screen.getByText(formatCurrencyUtil(29, 'JPY', 'en'))).toBeInTheDocument();
    });

    it('stacks the page header on mobile and puts it in a row from sm (mirrors Billing/Index)', () => {
        render(
            <Plans
                plans={[freePlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
            />
        );

        const heading = screen.getByText('Choose a Plan');
        const header = heading.closest('.flex.flex-col');

        expect(header).not.toBeNull();
        expect(header).toHaveClass('sm:flex-row');
        expect(header).toHaveClass('sm:items-center');
        expect(header).toHaveClass('sm:justify-between');
    });

    it('opens the bank-transfer instructions dialog when flash.bankTransfer arrives', () => {
        setPageProps({
            flash: {
                bankTransfer: {
                    type: 'bank_transfer',
                    subscription_id: 5,
                    reference: 'BT-777',
                    amount: 29,
                    plan_name: 'Pro',
                    instructions: 'Wire to account 1234',
                },
            },
        });

        render(
            <Plans
                plans={[proPlan]}
                paymentGateways={[paypalGateway]}
                currentPlanId={null}
                referralCreditBalance={0}
            />
        );

        expect(screen.getByText('Bank Transfer Instructions')).toBeInTheDocument();
        expect(screen.getByText('BT-777')).toBeInTheDocument();
        expect(screen.getByText('Wire to account 1234')).toBeInTheDocument();
    });
});
