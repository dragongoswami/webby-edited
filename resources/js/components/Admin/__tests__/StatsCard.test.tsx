import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Users } from 'lucide-react';
import { StatsCard } from '../StatsCard';

describe('StatsCard', () => {
    it('renders the title and a string value', () => {
        render(<StatsCard title="Total Users" value="1,234" icon={Users} />);

        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('renders a numeric value', () => {
        render(<StatsCard title="Total Users" value={42} icon={Users} />);

        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('does not render a trend badge when change is omitted', () => {
        render(<StatsCard title="Total Users" value={42} icon={Users} />);

        expect(screen.queryByText('vs last month')).not.toBeInTheDocument();
        expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('renders an up trend with success styling', () => {
        const { container } = render(
            <StatsCard
                title="Total Users"
                value={42}
                icon={Users}
                change={{ value: 12, trend: 'up' }}
            />
        );

        expect(screen.getByText((_, el) => el?.textContent === '12%')).toBeInTheDocument();
        expect(screen.getByText('vs last month')).toBeInTheDocument();
        expect(container.querySelector('[class*="text-success"]')).not.toBeNull();
        expect(container.querySelector('[class*="text-destructive"]')).toBeNull();
    });

    it('renders a down trend with destructive styling', () => {
        const { container } = render(
            <StatsCard
                title="Total Users"
                value={42}
                icon={Users}
                change={{ value: 5, trend: 'down' }}
            />
        );

        expect(screen.getByText((_, el) => el?.textContent === '5%')).toBeInTheDocument();
        expect(container.querySelector('[class*="text-destructive"]')).not.toBeNull();
        expect(container.querySelector('[class*="text-success"]')).toBeNull();
    });

    it('renders a neutral trend with muted styling', () => {
        const { container } = render(
            <StatsCard
                title="Total Users"
                value={42}
                icon={Users}
                change={{ value: 0, trend: 'neutral' }}
            />
        );

        expect(screen.getByText((_, el) => el?.textContent === '0%')).toBeInTheDocument();
        expect(container.querySelector('[class*="bg-muted"]')).not.toBeNull();
        expect(container.querySelector('[class*="bg-success/10"]')).toBeNull();
        expect(container.querySelector('[class*="bg-destructive/10"]')).toBeNull();
        expect(screen.getByText('vs last month')).toBeInTheDocument();
    });

    it('renders an svg icon for the card icon', () => {
        const { container } = render(<StatsCard title="Total Users" value={42} icon={Users} />);

        expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
    });
});
