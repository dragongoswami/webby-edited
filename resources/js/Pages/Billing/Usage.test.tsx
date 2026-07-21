import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { CreditPack, CreditPackGateway } from '@/types/billing';

// Radix Select/Progress/Tabs need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

let pageProps: Record<string, unknown>;
const routerGet = vi.fn();

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
    router: {
        get: (...args: unknown[]) => routerGet(...args),
        // usePageLoading subscribes to these lifecycle events.
        on: vi.fn(() => vi.fn()),
    },
    Link: ({ children, href, ...props }: { children?: React.ReactNode; href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { buyCreditsDialogMock } = vi.hoisted(() => ({ buyCreditsDialogMock: vi.fn() }));

vi.mock('@/components/Billing/BuyCreditsDialog', () => ({
    default: (props: { open: boolean; packs: unknown[]; gateways: unknown[] }) => {
        buyCreditsDialogMock(props);
        return (
            <div
                data-testid="buy-credits-dialog"
                data-open={String(props.open)}
                data-packs={props.packs.length}
                data-gateways={props.gateways.length}
            />
        );
    },
}));

import Usage from './Usage';

function makeStats(overrides: Record<string, unknown> = {}) {
    return {
        credits_remaining: 300,
        credits_used: 200,
        monthly_limit: 500,
        is_unlimited: false,
        reset_date: '2026-08-01',
        percentage_used: 40,
        ...overrides,
    };
}

function makePlan(overrides: Record<string, unknown> = {}) {
    return {
        name: 'Pro',
        monthly_build_credits: 500,
        is_unlimited: false,
        allows_own_api_key: true,
        ...overrides,
    };
}

function makeHistory(data: Record<string, unknown>[] = []) {
    return {
        data,
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: data.length,
    };
}

const record1 = {
    id: 1,
    project_id: 5,
    project_name: 'My Project',
    prompt_tokens: 1200,
    completion_tokens: 300,
    total_tokens: 1500,
    action: 'chat_message',
    used_own_api_key: false,
    created_at: '2026-06-15T10:00:00Z',
};

const record2 = {
    id: 2,
    project_id: null,
    project_name: null,
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
    action: 'build',
    used_own_api_key: false,
    created_at: '2026-06-16T10:00:00Z',
};

const pack1: CreditPack = {
    id: 1,
    name: 'Booster Pack',
    description: '1,000 extra credits',
    credits: 1000,
    bonus_credits: 0,
    price: 10,
    currency: 'USD',
    is_popular: false,
};

const gateway1: CreditPackGateway = {
    slug: 'paypal',
    name: 'PayPal',
    requires_manual_approval: false,
};

function setPageProps(overrides: Record<string, unknown> = {}) {
    pageProps = {
        auth: { user: { id: 1, name: 'Ada', email: 'ada@example.com' } },
        appSettings: { default_currency: 'USD', timezone: 'UTC', date_format: 'Y-m-d' },
        ...overrides,
    };
}

function baseProps(overrides: Record<string, unknown> = {}) {
    return {
        stats: makeStats(),
        plan: makePlan(),
        history: makeHistory(),
        period: 'current_month',
        used_own_api_key: null,
        creditPacks: [pack1],
        creditPackGateways: [gateway1],
        canBuyCredits: true,
        ...overrides,
    };
}

describe('Billing/Usage', () => {
    beforeEach(() => {
        routerGet.mockClear();
        buyCreditsDialogMock.mockClear();
        setPageProps();
    });

    it('renders credit stats for a normal plan (remaining/used/limit numbers)', () => {
        render(<Usage {...baseProps()} />);

        expect(screen.getByText('Remaining')).toBeInTheDocument();
        expect(screen.getByText('300 / 500')).toBeInTheDocument();
        expect(screen.getByText('Used this month')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
        expect(screen.getByText('Resets on')).toBeInTheDocument();
        expect(screen.getByText('2026-08-01')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    it('stacks the page header on mobile and puts it in a row from sm (mirrors Billing/Index)', () => {
        render(<Usage {...baseProps()} />);

        const heading = screen.getByRole('heading', { name: 'Usage' });
        const header = heading.closest('.flex.flex-col');

        expect(header).not.toBeNull();
        expect(header).toHaveClass('sm:flex-row');
        expect(header).toHaveClass('sm:items-center');
        expect(header).toHaveClass('sm:justify-between');
    });

    it('renders the unlimited-credits variant instead of remaining/used numbers', () => {
        render(<Usage {...baseProps({ stats: makeStats({ is_unlimited: true }) })} />);

        expect(screen.getByText('You have unlimited build credits')).toBeInTheDocument();
        expect(screen.getByText('Unlimited')).toBeInTheDocument();
        expect(screen.queryByText('Remaining')).not.toBeInTheDocument();
    });

    it('own-API-key variant: used_own_api_key=true starts on the "Your API Key Usage" tab', () => {
        render(
            <Usage
                {...baseProps({
                    used_own_api_key: true,
                    history: makeHistory([record1]),
                })}
            />
        );

        const ownKeyTab = screen.getByRole('tab', { name: /Your API Key Usage/ });
        const planTab = screen.getByRole('tab', { name: /Plan Usage/ });
        expect(ownKeyTab).toHaveAttribute('data-state', 'active');
        expect(planTab).toHaveAttribute('data-state', 'inactive');

        // Own-key columns include "Total" (not "Credits Used") and omit the Action column.
        const panel = screen.getByRole('tabpanel');
        expect(within(panel).getByText('Total')).toBeInTheDocument();
        expect(within(panel).queryByText('Action')).not.toBeInTheDocument();
    });

    it('renders usage-history rows in the table when data is present (plan tab)', () => {
        render(<Usage {...baseProps({ history: makeHistory([record1, record2]) })} />);

        expect(screen.getByText('My Project')).toBeInTheDocument();
        expect(screen.getByText('chat message')).toBeInTheDocument();
        expect(screen.getByText('1.5K')).toBeInTheDocument();
        // Record without a project renders a dash instead of a link.
        expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
    });

    it('shows the empty state when the plan-usage history is empty', () => {
        render(<Usage {...baseProps({ history: makeHistory([]) })} />);

        expect(screen.getByText('No plan usage')).toBeInTheDocument();
        expect(
            screen.getByText("Usage from your plan's AI credits will appear here.")
        ).toBeInTheDocument();
    });

    it('switching the period calls router.get with the period param', () => {
        render(<Usage {...baseProps({ period: 'current_month' })} />);

        fireEvent.click(screen.getByRole('button', { name: 'All Time' }));

        expect(routerGet).toHaveBeenCalledTimes(1);
        const [url, data] = routerGet.mock.calls[0];
        expect(url).toBe('/billing.usage');
        expect(data).toEqual({ period: 'all', used_own_api_key: null });
    });

    it('switching tabs shows the right panel and posts the new used_own_api_key filter', () => {
        render(<Usage {...baseProps({ history: makeHistory([record1]) })} />);

        // Starts on the Plan Usage panel.
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', expect.stringContaining('plan'));

        // Radix TabsTrigger switches on mousedown, not click.
        fireEvent.mouseDown(screen.getByRole('tab', { name: /Your API Key Usage/ }), { button: 0 });

        expect(screen.getByRole('tab', { name: /Your API Key Usage/ })).toHaveAttribute('data-state', 'active');
        expect(routerGet).toHaveBeenCalledTimes(1);
        const [url, data, options] = routerGet.mock.calls[0];
        expect(url).toBe('/billing.usage');
        expect(data).toEqual({ period: 'current_month', used_own_api_key: true });
        expect(options).toEqual({ preserveState: false, preserveScroll: true });
    });

    it('hides the Buy Credits button when canBuyCredits is false', () => {
        render(<Usage {...baseProps({ canBuyCredits: false })} />);
        expect(screen.queryByRole('button', { name: /Buy Credits/ })).not.toBeInTheDocument();
    });

    it('hides the Buy Credits button when creditPacks is empty', () => {
        render(<Usage {...baseProps({ creditPacks: [] })} />);
        expect(screen.queryByRole('button', { name: /Buy Credits/ })).not.toBeInTheDocument();
    });

    it('shows the Buy Credits button when canBuyCredits is true and packs exist, and clicking it opens the dialog', () => {
        render(<Usage {...baseProps()} />);

        const button = screen.getByRole('button', { name: /Buy Credits/ });
        expect(button).toBeInTheDocument();

        // Dialog mock starts closed.
        expect(screen.getByTestId('buy-credits-dialog')).toHaveAttribute('data-open', 'false');

        fireEvent.click(button);

        expect(screen.getByTestId('buy-credits-dialog')).toHaveAttribute('data-open', 'true');
    });

    it('passes creditPacks/creditPackGateways through to BuyCreditsDialog', () => {
        render(<Usage {...baseProps({ creditPacks: [pack1], creditPackGateways: [gateway1] })} />);

        const dialogEl = screen.getByTestId('buy-credits-dialog');
        expect(dialogEl).toHaveAttribute('data-packs', '1');
        expect(dialogEl).toHaveAttribute('data-gateways', '1');

        expect(buyCreditsDialogMock).toHaveBeenCalled();
        const lastCall = buyCreditsDialogMock.mock.calls[buyCreditsDialogMock.mock.calls.length - 1][0];
        expect(lastCall.packs).toEqual([pack1]);
        expect(lastCall.gateways).toEqual([gateway1]);
    });
});
