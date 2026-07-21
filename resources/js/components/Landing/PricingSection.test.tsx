import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatCurrency } from '@/lib/currency';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (returns key as translation, with :placeholder interpolation).

let pageProps: Record<string, unknown> = { appSettings: { default_currency: 'USD' } };

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
    Link: ({ children, href, ...props }: { children?: React.ReactNode; href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

import { PricingSection } from './PricingSection';

interface PlanOverrides {
    id?: number;
    name?: string;
    slug?: string;
    description?: string | null;
    price?: string;
    billing_period?: 'monthly' | 'yearly' | 'lifetime';
    features?: { name: string; included: boolean }[];
    is_popular?: boolean;
    max_projects?: number | null;
    monthly_build_credits?: number;
    allow_user_ai_api_key?: boolean;
}

function makePlan(overrides: PlanOverrides = {}) {
    return {
        id: 1,
        name: 'Starter',
        slug: 'starter',
        description: null,
        price: '0',
        billing_period: 'monthly' as const,
        features: [],
        is_popular: false,
        max_projects: 3,
        monthly_build_credits: 100,
        allow_user_ai_api_key: false,
        ...overrides,
    };
}

function setCurrency(currency: string) {
    pageProps = { appSettings: { default_currency: currency } };
}

describe('PricingSection', () => {
    beforeEach(() => {
        setCurrency('USD');
    });

    it('renders nothing when plans is empty', () => {
        const { container } = render(<PricingSection plans={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders a plan card with name, formatted price, billing label, and features', () => {
        const plan = makePlan({
            name: 'Pro',
            price: '29',
            billing_period: 'monthly',
            max_projects: 20,
        });

        render(<PricingSection plans={[plan]} />);

        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText(formatCurrency(29, 'USD'))).toBeInTheDocument();
        expect(screen.getByText('/month')).toBeInTheDocument();
        expect(screen.getByText('20 projects')).toBeInTheDocument();
    });

    it('renders the correct billing-period label for monthly, yearly, and lifetime plans', () => {
        const monthly = makePlan({ id: 1, name: 'Monthly Plan', billing_period: 'monthly' });
        const yearly = makePlan({ id: 2, name: 'Yearly Plan', billing_period: 'yearly' });
        const lifetime = makePlan({ id: 3, name: 'Lifetime Plan', billing_period: 'lifetime' });

        render(<PricingSection plans={[monthly, yearly, lifetime]} />);

        expect(screen.getByText('/month')).toBeInTheDocument();
        expect(screen.getByText('/year')).toBeInTheDocument();
        // Lifetime's label is an empty string, so there's no "/..." suffix text
        // for that plan — only the two above should be present.
        expect(screen.queryByText('/lifetime')).not.toBeInTheDocument();
    });

    it('shows the "Most Popular" badge only for a plan flagged is_popular', () => {
        const popular = makePlan({ id: 1, name: 'Pro', is_popular: true });
        const regular = makePlan({ id: 2, name: 'Basic', is_popular: false });

        render(<PricingSection plans={[popular, regular]} />);

        expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('does not show the "Most Popular" badge when no plan is popular', () => {
        const plan = makePlan({ is_popular: false });
        render(<PricingSection plans={[plan]} />);
        expect(screen.queryByText('Most Popular')).not.toBeInTheDocument();
    });

    it('uses a single-column max-w-md grid for one plan', () => {
        const { container } = render(<PricingSection plans={[makePlan()]} />);
        const grid = container.querySelector('.grid');
        expect(grid).toHaveClass('max-w-md', 'grid-cols-1');
        expect(grid).not.toHaveClass('md:grid-cols-2');
    });

    it('uses a two-column max-w-3xl grid for two plans', () => {
        const { container } = render(
            <PricingSection plans={[makePlan({ id: 1 }), makePlan({ id: 2, name: 'Plan B' })]} />
        );
        const grid = container.querySelector('.grid');
        expect(grid).toHaveClass('max-w-3xl', 'md:grid-cols-2');
        expect(grid).not.toHaveClass('lg:grid-cols-3');
    });

    it('uses a three-column max-w-5xl grid for three or more plans', () => {
        const { container } = render(
            <PricingSection
                plans={[
                    makePlan({ id: 1, name: 'Plan A' }),
                    makePlan({ id: 2, name: 'Plan B' }),
                    makePlan({ id: 3, name: 'Plan C' }),
                ]}
            />
        );
        const grid = container.querySelector('.grid');
        expect(grid).toHaveClass('max-w-5xl', 'md:grid-cols-2', 'lg:grid-cols-3');
    });

    it('renders a "Get Started" link to /billing/plans for every plan card', () => {
        render(
            <PricingSection
                plans={[makePlan({ id: 1, name: 'Plan A' }), makePlan({ id: 2, name: 'Plan B' })]}
            />
        );

        const links = screen.getAllByRole('link', { name: 'Get Started' });
        expect(links).toHaveLength(2);
        links.forEach((link) => expect(link).toHaveAttribute('href', '/billing/plans'));
    });

    it('renders content.title and content.subtitle overrides when provided', () => {
        render(
            <PricingSection
                plans={[makePlan()]}
                content={{ title: 'Custom Title', subtitle: 'Custom Subtitle' }}
            />
        );

        expect(screen.getByText('Custom Title')).toBeInTheDocument();
        expect(screen.getByText('Custom Subtitle')).toBeInTheDocument();
    });

    it('falls back to default title and subtitle translation keys when content is absent', () => {
        render(<PricingSection plans={[makePlan()]} />);

        expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Choose the plan that fits your needs. All plans include access to our AI-powered website builder.'
            )
        ).toBeInTheDocument();
    });

    it('gates plugin-provided feature rows on pluginCapabilities: hidden when off, shown when on', () => {
        const plan = makePlan({ features: [] });

        const { rerender } = render(
            <PricingSection plans={[plan]} pluginCapabilities={{ wordpress: false }} />
        );
        expect(screen.queryByText('WordPress themes')).not.toBeInTheDocument();

        rerender(<PricingSection plans={[plan]} pluginCapabilities={{ wordpress: true }} />);
        expect(screen.getByText('WordPress themes')).toBeInTheDocument();
    });

    it('formats a zero-decimal currency (JPY) without decimals, using the real formatter', () => {
        setCurrency('JPY');
        const plan = makePlan({ price: '2900' });

        render(<PricingSection plans={[plan]} />);

        expect(screen.getByText(formatCurrency(2900, 'JPY'))).toBeInTheDocument();
        expect(screen.queryByText(/\.00/)).not.toBeInTheDocument();
    });
});
