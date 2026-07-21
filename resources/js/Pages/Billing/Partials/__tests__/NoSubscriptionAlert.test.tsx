import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NoSubscriptionAlert from '../NoSubscriptionAlert';
import type { Plan } from '@/types/billing';
import { formatCurrency } from '@/lib/currency';

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: { appSettings: { default_currency: 'USD' } } }),
}));

const makePlan = (overrides: Partial<Plan> = {}): Plan => ({
    id: 1,
    name: 'Pro',
    slug: 'pro',
    description: null,
    price: 29,
    billing_period: 'monthly',
    features: [],
    is_active: true,
    is_popular: false,
    sort_order: 0,
    max_projects: null,
    monthly_build_credits: null,
    allow_user_ai_api_key: false,
    enable_subdomains: true,
    max_subdomains_per_user: null,
    allow_private_visibility: true,
    enable_file_storage: true,
    max_storage_mb: null,
    max_file_size_mb: 10,
    allowed_file_types: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
});

describe('NoSubscriptionAlert', () => {
    it('renders the no-subscription prompt when no plan is given', () => {
        render(<NoSubscriptionAlert />);

        expect(screen.getByText('No Active Subscription')).toBeInTheDocument();
        expect(
            screen.getByText('Choose a plan to get started with building your projects.'),
        ).toBeInTheDocument();
        expect(screen.queryByText('Current Plan')).not.toBeInTheDocument();
    });

    it('renders the current plan with a monthly period suffix', () => {
        const plan = makePlan({ name: 'Pro', price: 29, billing_period: 'monthly' });
        render(<NoSubscriptionAlert plan={plan} />);

        expect(screen.getByText('Current Plan')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText(formatCurrency(29, 'USD', 'en'))).toBeInTheDocument();
        expect(screen.getByText('/month')).toBeInTheDocument();
        expect(screen.queryByText('No Active Subscription')).not.toBeInTheDocument();
    });

    it('omits the billing-period suffix for a lifetime plan', () => {
        const plan = makePlan({ name: 'Lifetime', price: 299, billing_period: 'lifetime' });
        render(<NoSubscriptionAlert plan={plan} />);

        expect(screen.getByText('Current Plan')).toBeInTheDocument();
        expect(screen.getByText('Lifetime')).toBeInTheDocument();
        expect(screen.getByText(formatCurrency(299, 'USD', 'en'))).toBeInTheDocument();
        expect(screen.queryByText('/month')).not.toBeInTheDocument();
        expect(screen.queryByText('/year')).not.toBeInTheDocument();
        expect(screen.queryByText(' one-time')).not.toBeInTheDocument();
    });

    it('falls back to the monthly label for an unknown billing period', () => {
        const plan = makePlan({
            name: 'Custom',
            price: 10,
            billing_period: 'weekly' as Plan['billing_period'],
        });
        render(<NoSubscriptionAlert plan={plan} />);

        expect(screen.getByText('Current Plan')).toBeInTheDocument();
        expect(screen.getByText('Custom')).toBeInTheDocument();
        expect(screen.getByText(formatCurrency(10, 'USD', 'en'))).toBeInTheDocument();
        expect(screen.getByText('/month')).toBeInTheDocument();
    });
});
