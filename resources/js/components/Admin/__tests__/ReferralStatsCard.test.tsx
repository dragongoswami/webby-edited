import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReferralStatsCard } from '../ReferralStatsCard';
import type { ReferralStats } from '@/types/admin';

vi.mock('@/hooks/useCurrency', () => ({
    useCurrency: () => ({
        currency: 'USD',
        symbol: '$',
        format: (amount: number) => '$' + Number(amount).toFixed(2),
    }),
}));

vi.mock('@inertiajs/react', () => ({
    Link: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

const makeStats = (overrides: Partial<ReferralStats> = {}): ReferralStats => ({
    total: 0,
    converted: 0,
    credited: 0,
    commission_paid: 0,
    pending_earnings: 0,
    ...overrides,
});

describe('ReferralStatsCard', () => {
    it('renders the referral stat counts and formatted commission', () => {
        render(
            <ReferralStatsCard
                stats={makeStats({
                    total: 120,
                    converted: 45,
                    credited: 30,
                    commission_paid: 250.5,
                    pending_earnings: 0,
                })}
            />
        );

        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('$250.50')).toBeInTheDocument();

        const link = screen.getByRole('link', { name: /View All/i });
        expect(link).toHaveAttribute('href', '/admin/referrals');
    });

    it('shows the Pending Earnings section when pending_earnings is positive', () => {
        render(
            <ReferralStatsCard
                stats={makeStats({
                    commission_paid: 250.5,
                    pending_earnings: 75.25,
                })}
            />
        );

        expect(screen.getByText('Pending Earnings')).toBeInTheDocument();
        expect(screen.getByText('$75.25')).toBeInTheDocument();
    });

    it('hides the Pending Earnings section when pending_earnings is zero', () => {
        render(<ReferralStatsCard stats={makeStats({ pending_earnings: 0 })} />);

        expect(screen.queryByText('Pending Earnings')).not.toBeInTheDocument();
    });

    it('hides the Pending Earnings section when pending_earnings is negative', () => {
        render(<ReferralStatsCard stats={makeStats({ pending_earnings: -5 })} />);

        expect(screen.queryByText('Pending Earnings')).not.toBeInTheDocument();
    });
});
