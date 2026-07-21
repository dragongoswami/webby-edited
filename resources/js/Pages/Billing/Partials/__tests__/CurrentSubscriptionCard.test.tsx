import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import CurrentSubscriptionCard from '../CurrentSubscriptionCard';
import type { Subscription, Plan } from '@/types/billing';

// useAppDate reads Inertia's usePage(), which isn't wired up in this render tree.
// A passthrough formatter keeps assertions about *content presence* honest
// without pulling in a full date-formatting implementation unrelated to this
// component's behavior.
vi.mock('@/lib/date', () => ({
    useAppDate: () => ({
        formatDate: (value: string | null | undefined) => value ?? '-',
    }),
}));

const { routerPost } = vi.hoisted(() => ({ routerPost: vi.fn() }));

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: { appSettings: { default_currency: 'USD' } } }),
    router: { post: (...args: unknown[]) => routerPost(...args) },
}));

// Radix AlertDialog needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

beforeEach(() => {
    routerPost.mockClear();
    (globalThis as { route: (name: string) => string }).route = (name: string) => '/' + name;
});

const makePlan = (overrides: Partial<Plan> = {}): Plan => ({
    id: 1,
    name: 'Pro',
    slug: 'pro',
    description: null,
    price: 20,
    billing_period: 'monthly',
    features: ['Feature A', 'Feature B'],
    is_active: true,
    is_popular: false,
    sort_order: 1,
    max_projects: null,
    monthly_build_credits: null,
    allow_user_ai_api_key: true,
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

const makeSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
    id: 1,
    user_id: 1,
    plan_id: 1,
    status: 'active',
    amount: 20,
    payment_method: 'paypal',
    external_subscription_id: null,
    billing_info: null,
    approved_by: null,
    approved_at: null,
    admin_notes: null,
    payment_proof: null,
    starts_at: '2026-01-01T00:00:00Z',
    renewal_at: '2026-02-01T00:00:00Z',
    ends_at: null,
    cancelled_at: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    plan: makePlan(),
    ...overrides,
});

describe('CurrentSubscriptionCard', () => {
    it('renders plan name, falls back to Unknown Plan when plan is null', () => {
        const { rerender } = render(<CurrentSubscriptionCard subscription={makeSubscription()} />);
        expect(screen.getByText('Pro')).toBeInTheDocument();

        rerender(<CurrentSubscriptionCard subscription={makeSubscription({ plan: null as unknown as Plan })} />);
        expect(screen.getByText('Unknown Plan')).toBeInTheDocument();
    });

    it('maps payment method label and falls back', () => {
        const { rerender } = render(
            <CurrentSubscriptionCard subscription={makeSubscription({ payment_method: 'paypal' })} />
        );
        expect(screen.getByText('PayPal')).toBeInTheDocument();

        rerender(
            <CurrentSubscriptionCard
                subscription={makeSubscription({ payment_method: 'some_gw' as Subscription['payment_method'] })}
            />
        );
        expect(screen.getByText('some_gw')).toBeInTheDocument();

        rerender(<CurrentSubscriptionCard subscription={makeSubscription({ payment_method: null })} />);
        expect(screen.getByText('Not specified')).toBeInTheDocument();
    });

    it('renews vs valid-until label and value', () => {
        const { rerender } = render(
            <CurrentSubscriptionCard
                subscription={makeSubscription({
                    renewal_at: '2026-08-01T00:00:00Z',
                    plan: makePlan({ billing_period: 'monthly' }),
                })}
            />
        );
        expect(screen.getByText('Next Renewal')).toBeInTheDocument();
        expect(screen.getByText('2026-08-01T00:00:00Z')).toBeInTheDocument();

        rerender(
            <CurrentSubscriptionCard
                subscription={makeSubscription({
                    renewal_at: null,
                    plan: makePlan({ billing_period: 'lifetime' }),
                })}
            />
        );
        expect(screen.getByText('Valid Until')).toBeInTheDocument();
        expect(screen.getByText('Lifetime Access')).toBeInTheDocument();

        rerender(
            <CurrentSubscriptionCard
                subscription={makeSubscription({
                    renewal_at: null,
                    plan: makePlan({ billing_period: 'monthly' }),
                })}
            />
        );
        expect(screen.getByText('Next Renewal')).toBeInTheDocument();
        expect(screen.getByText('Not set')).toBeInTheDocument();
    });

    // `plan.features` is always a JSON array at runtime: Laravel casts it with
    // the 'array' cast (app/Models/Plan.php:70), PlanSeeder always stores a JSON
    // array of `{name, included}` objects, and the TS type is
    // `features: (string | PlanFeature)[]`. So `Array.isArray(plan.features)` is
    // always true, and the component's `typeof === 'object' && !Array.isArray(...)`
    // object-branch (CurrentSubscriptionCard.tsx:136-141) is unreachable dead code
    // for a shape the type/backend never produce — this suite asserts the real,
    // reachable array + empty paths instead.
    it('renders array features as badges (object entries by name, strings as-is), and hides the section when empty', () => {
        const { rerender } = render(
            <CurrentSubscriptionCard
                subscription={makeSubscription({
                    plan: makePlan({
                        features: [
                            { name: 'Feature A', included: true },
                            { name: 'Feature B', included: true },
                        ],
                    }),
                })}
            />
        );
        expect(screen.getByText('Plan Features')).toBeInTheDocument();
        expect(screen.getByText('Feature A')).toBeInTheDocument();
        expect(screen.getByText('Feature B')).toBeInTheDocument();

        rerender(
            <CurrentSubscriptionCard
                subscription={makeSubscription({
                    plan: makePlan({ features: ['Alpha', 'Beta'] }),
                })}
            />
        );
        expect(screen.getByText('Plan Features')).toBeInTheDocument();
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();

        rerender(
            <CurrentSubscriptionCard
                subscription={makeSubscription({
                    plan: makePlan({ features: [] }),
                })}
            />
        );
        expect(screen.queryByText('Plan Features')).not.toBeInTheDocument();

        rerender(
            <CurrentSubscriptionCard
                subscription={makeSubscription({ plan: null as unknown as Plan })}
            />
        );
        expect(screen.queryByText('Plan Features')).not.toBeInTheDocument();
    });

    it('renders cancel button only when active, and confirming posts to billing.cancel', async () => {
        const user = userEvent.setup();
        const { rerender } = render(<CurrentSubscriptionCard subscription={makeSubscription({ status: 'active' })} />);
        expect(screen.getByRole('button', { name: 'Cancel Subscription' })).toBeInTheDocument();

        rerender(<CurrentSubscriptionCard subscription={makeSubscription({ status: 'cancelled' })} />);
        expect(screen.queryByRole('button', { name: 'Cancel Subscription' })).not.toBeInTheDocument();

        rerender(<CurrentSubscriptionCard subscription={makeSubscription({ status: 'active' })} />);
        await user.click(screen.getByRole('button', { name: 'Cancel Subscription' }));

        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Yes, Cancel' }));

        expect(routerPost).toHaveBeenCalled();
        expect(routerPost.mock.calls[0][0]).toBe('/billing.cancel');
    });
});
