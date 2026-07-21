import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Subscription, Plan, SubscriptionFilters, PaginatedResponse } from '@/types/billing';

// Radix Dialog/Select need these pointer APIs, which jsdom doesn't implement.
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
        // useAdminLoading (used internally by Subscriptions) subscribes to these.
        on: vi.fn(() => vi.fn()),
    },
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// useCurrency/useAppDate both read Inertia's usePage(), which isn't wired up in
// this render tree. Passthrough formatters keep assertions about *content
// presence* honest without pulling in an unrelated page-props mock.
vi.mock('@/hooks/useCurrency', () => ({
    useCurrency: () => ({
        currency: 'USD',
        symbol: '$',
        format: (amount: number) => `$${amount}`,
    }),
}));

vi.mock('@/lib/date', () => ({
    useAppDate: () => ({
        formatDate: (value: string | null | undefined) => value ?? '-',
        formatDateTime: (value: string | null | undefined) => value ?? '-',
        formatRelativeTime: (value: string | null | undefined) => value ?? '-',
    }),
}));

// UserSelect performs its own debounced fetch() against admin.users.search,
// which is unrelated to Subscriptions' own behavior. Replace it with a plain
// text input so the Create form can be filled synchronously.
vi.mock('@/components/Admin/UserSelect', () => ({
    UserSelect: ({
        value,
        onChange,
    }: {
        value: string;
        onChange: (value: string) => void;
        error?: boolean;
    }) => (
        <input
            aria-label="user_id"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    ),
}));

// The global `route()` helper is stubbed by the test setup to ignore params
// (`/${name}`), which would hide a bug where the wrong id is passed. Replace
// it here with a spy that embeds the param so we can assert on the real URL.
const routeSpy = vi.fn((name: string, param?: string | number) =>
    param !== undefined ? `/${name}/${param}` : `/${name}`
);
(globalThis as unknown as { route: typeof routeSpy }).route = routeSpy;

import Subscriptions from './Subscriptions';

const currentAdmin = {
    id: 1,
    name: 'Current Admin',
    email: 'admin@example.com',
} as never;

function makePlan(overrides: Partial<Plan> = {}): Plan {
    return {
        id: 1,
        name: 'Pro',
        slug: 'pro',
        description: null,
        price: 29,
        billing_period: 'monthly',
        features: [],
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
    } as Plan;
}

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
    return {
        id: 10,
        user_id: 2,
        plan_id: 1,
        status: 'active',
        amount: 29,
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
        user: { id: 2, name: 'Jane Doe', email: 'jane@example.com' } as never,
        plan: makePlan(),
        ...overrides,
    };
}

function makePagination(
    data: Subscription[],
    overrides: Partial<PaginatedResponse<Subscription>> = {}
): PaginatedResponse<Subscription> {
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

const stats = { total: 0, active: 0, pending: 0, cancelled: 0, expiring_soon: 0 };

function renderPage(
    subscriptionsList: Subscription[],
    pagination = makePagination(subscriptionsList),
    filters: SubscriptionFilters = {},
    plans: Plan[] = [makePlan()]
) {
    return render(
        <Subscriptions
            auth={{ user: currentAdmin }}
            subscriptions={pagination}
            stats={stats}
            plans={plans}
            filters={filters}
        />
    );
}

describe('Admin/Subscriptions', () => {
    beforeEach(() => {
        routerGet.mockClear();
        routerPost.mockClear();
        routerVisit.mockClear();
        routeSpy.mockClear();
    });

    it('renders subscription rows with user, plan, status, and payment method from props', () => {
        renderPage([
            makeSubscription({
                id: 10,
                user: { id: 2, name: 'Jane Doe', email: 'jane@example.com' } as never,
                plan: makePlan({ name: 'Pro' }),
                status: 'active',
                payment_method: 'paypal',
            }),
        ]);

        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('jane@example.com')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('PayPal')).toBeInTheDocument();
    });

    it('shows an empty state when there are no subscriptions', () => {
        renderPage([], makePagination([]));

        expect(screen.getByText('No results.')).toBeInTheDocument();
    });

    it('debounces the search input before navigating with the search param', async () => {
        renderPage([makeSubscription()]);

        fireEvent.change(screen.getByPlaceholderText('Search by user name or email...'), {
            target: { value: 'jane' },
        });

        // Not fired immediately — debounced.
        expect(routerGet).not.toHaveBeenCalled();

        await waitFor(() => {
            expect(routerGet).toHaveBeenCalledTimes(1);
        });

        expect(routeSpy).toHaveBeenCalledWith('admin.subscriptions');
        const [url, params] = routerGet.mock.calls[0];
        expect(url).toBe('/admin.subscriptions');
        expect(params).toEqual({ search: 'jane', page: 1 });
    });

    it('changing the status filter navigates with the status param', async () => {
        const user = userEvent.setup();
        renderPage([makeSubscription()], undefined, {});

        // Status is the first of the three toolbar Selects.
        const comboboxes = screen.getAllByRole('combobox');
        await user.click(comboboxes[0]);
        await user.click(await screen.findByRole('option', { name: 'Active' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.subscriptions');
        expect(routerGet).toHaveBeenCalledTimes(1);
        const [url, params] = routerGet.mock.calls[0];
        expect(url).toBe('/admin.subscriptions');
        expect(params).toEqual({ status: 'active', page: 1 });
    });

    it('Create dialog: fills the form and submits to the store route with createForm payload', async () => {
        const user = userEvent.setup();
        renderPage([makeSubscription()], undefined, {}, [makePlan({ id: 4, name: 'Business' })]);

        fireEvent.click(screen.getByRole('button', { name: 'Create Subscription' }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Manually create a subscription for a user.')).toBeInTheDocument();

        fireEvent.change(within(dialog).getByLabelText('user_id'), { target: { value: '7' } });

        // Plan select (first combobox inside the dialog).
        const comboboxes = within(dialog).getAllByRole('combobox');
        await user.click(comboboxes[0]);
        await user.click(await screen.findByRole('option', { name: /Business/ }));

        fireEvent.change(within(dialog).getByLabelText('Admin Notes'), {
            target: { value: 'Manually granted' },
        });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.subscriptions.store');
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.subscriptions.store');
        expect(data).toEqual({
            user_id: '7',
            plan_id: '4',
            status: 'active',
            admin_notes: 'Manually granted',
        });
    });

    it('Create dialog: blocks submit and shows validation messages when required fields are empty', () => {
        renderPage([makeSubscription()]);

        fireEvent.click(screen.getByRole('button', { name: 'Create Subscription' }));
        const dialog = screen.getByRole('dialog');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

        expect(within(dialog).getByText('User is required')).toBeInTheDocument();
        expect(within(dialog).getByText('Plan is required')).toBeInTheDocument();
        expect(routerPost).not.toHaveBeenCalled();
    });

    it('Cancel: opens an AlertDialog confirm (not window.confirm), and confirming posts to the cancel route with the reason and immediate flag', () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        renderPage([makeSubscription({ id: 11, status: 'active' })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel' }));

        expect(confirmSpy).not.toHaveBeenCalled();
        const dialog = screen.getByRole('alertdialog');
        fireEvent.change(within(dialog).getByLabelText('Reason (optional)'), {
            target: { value: 'User requested' },
        });
        fireEvent.click(within(dialog).getByLabelText('Cancel immediately (ends access now)'));

        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel Subscription' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.subscriptions.cancel', 11);
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.subscriptions.cancel/11');
        expect(data).toEqual({ reason: 'User requested', immediate: true });
    });

    it('Extend: setting days and reason posts to the extend route with the id and extendForm', () => {
        renderPage([makeSubscription({ id: 12, status: 'active' })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Extend' }));

        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Days to extend'), {
            target: { value: '60' },
        });
        fireEvent.change(within(dialog).getByLabelText('Reason (optional)'), {
            target: { value: 'Goodwill extension' },
        });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Extend' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.subscriptions.extend', 12);
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.subscriptions.extend/12');
        expect(data).toEqual({ days: 60, reason: 'Goodwill extension' });
    });

    it('Approve: confirming posts to the approve route with the id and approveForm notes', () => {
        renderPage([makeSubscription({ id: 13, status: 'pending' })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Approve' }));

        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Notes (optional)'), {
            target: { value: 'Bank transfer confirmed' },
        });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.subscriptions.approve', 13);
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.subscriptions.approve/13');
        expect(data).toEqual({ notes: 'Bank transfer confirmed' });
    });

    it('server pagination: clicking next page navigates with the incremented page param', () => {
        renderPage(
            [makeSubscription()],
            makePagination([makeSubscription()], { current_page: 1, last_page: 3, per_page: 10, total: 25 })
        );

        fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.subscriptions');
        expect(routerGet).toHaveBeenCalledTimes(1);
        const [url, params] = routerGet.mock.calls[0];
        expect(url).toBe('/admin.subscriptions');
        expect(params).toEqual({ page: 2 });
    });

    it('renders the correct status badge label and style per subscription status', () => {
        renderPage([
            makeSubscription({ id: 1, status: 'active' }),
            makeSubscription({ id: 2, status: 'pending' }),
            makeSubscription({ id: 3, status: 'expired' }),
            makeSubscription({ id: 4, status: 'cancelled' }),
        ]);

        expect(screen.getByText('Active').className).toContain('bg-primary/10');
        expect(screen.getByText('Pending').className).toContain('bg-accent');
        expect(screen.getByText('Expired').className).toContain('bg-muted');
        expect(screen.getByText('Cancelled').className).toContain('bg-destructive/10');
    });
});
