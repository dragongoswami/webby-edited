import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { TrendLineChart } from '../TrendLineChart';
import type { TrendData } from '@/types/admin';

// Radix Tabs needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart">{children}</div>,
    AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
}));

vi.mock('@/hooks/useChartColors', () => ({
    useChartColors: () => ({
        border: '#000',
        mutedForeground: '#666',
        tooltipBg: '#fff',
        tooltipFg: '#000',
    }),
}));

vi.mock('@/hooks/useCurrency', () => ({
    useCurrency: () => ({ symbol: '$' }),
}));

function buildData(overrides: Partial<TrendData>): TrendData {
    return {
        revenue: [{ date: '2026-01-01', value: 50 }],
        users: [{ date: '2026-01-01', value: 5 }],
        projects: [{ date: '2026-01-01', value: 2 }],
        ...overrides,
    };
}

describe('TrendLineChart', () => {
    it('shows the empty-state when the active (revenue) series is empty', () => {
        const data = buildData({ revenue: [] });
        render(<TrendLineChart data={data} />);

        expect(screen.getByText('No revenue data for this period')).toBeInTheDocument();
        expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    });

    it('shows the empty-state when all revenue values are zero', () => {
        const data = buildData({
            revenue: [
                { date: '2026-01-01', value: 0 },
                { date: '2026-01-02', value: 0 },
            ],
        });
        render(<TrendLineChart data={data} />);

        expect(screen.getByText('No revenue data for this period')).toBeInTheDocument();
        expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    });

    it('renders the chart when the revenue series has a positive value', () => {
        const data = buildData({ revenue: [{ date: '2026-01-01', value: 100 }] });
        render(<TrendLineChart data={data} />);

        expect(screen.getByTestId('chart')).toBeInTheDocument();
        expect(screen.queryByText('No revenue data for this period')).not.toBeInTheDocument();
    });

    it('renders the three tab triggers with revenue active by default', () => {
        const data = buildData({});
        render(<TrendLineChart data={data} />);

        expect(screen.getByRole('tab', { name: 'Revenue' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Users' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Projects' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Revenue' })).toHaveAttribute('aria-selected', 'true');
    });

    it('switching to the Users tab shows its series', async () => {
        const user = userEvent.setup();
        const data = buildData({ revenue: [], users: [{ date: '2026-01-01', value: 7 }] });
        render(<TrendLineChart data={data} />);

        expect(screen.getByText('No revenue data for this period')).toBeInTheDocument();

        await user.click(screen.getByRole('tab', { name: 'Users' }));

        expect(screen.getByTestId('chart')).toBeInTheDocument();
        expect(screen.queryByText('No revenue data for this period')).not.toBeInTheDocument();
    });

    it("switching to a tab whose series is empty shows that tab's empty-state", async () => {
        const user = userEvent.setup();
        const data = buildData({ users: [] });
        render(<TrendLineChart data={data} />);

        await user.click(screen.getByRole('tab', { name: 'Users' }));

        expect(screen.getByText('No new users data for this period')).toBeInTheDocument();
        expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    });
});
