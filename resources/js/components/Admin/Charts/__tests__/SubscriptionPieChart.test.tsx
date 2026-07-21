import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SubscriptionPieChart } from '../SubscriptionPieChart';
import type { SubscriptionDistributionItem } from '@/types/admin';

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart">{children}</div>,
    PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Pie: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Cell: () => null,
    Legend: () => null,
    Tooltip: () => null,
}));

vi.mock('@/hooks/useChartColors', () => ({
    useChartColors: () => ({
        border: '#000',
        tooltipBg: '#fff',
        tooltipFg: '#000',
    }),
}));

describe('SubscriptionPieChart', () => {
    it('shows the empty-state when data is an empty array', () => {
        const data: SubscriptionDistributionItem[] = [];
        render(<SubscriptionPieChart data={data} />);

        expect(screen.getByText('No subscription data available')).toBeInTheDocument();
        expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    });

    it('shows the empty-state when all counts are zero', () => {
        const data: SubscriptionDistributionItem[] = [
            { name: 'Free', count: 0, color: '#aaa' },
            { name: 'Pro', count: 0, color: '#bbb' },
        ];
        render(<SubscriptionPieChart data={data} />);

        expect(screen.getByText('No subscription data available')).toBeInTheDocument();
        expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    });

    it('renders the chart when at least one count is positive', () => {
        const data: SubscriptionDistributionItem[] = [
            { name: 'Free', count: 0, color: '#aaa' },
            { name: 'Pro', count: 12, color: '#bbb' },
        ];
        render(<SubscriptionPieChart data={data} />);

        expect(screen.getByTestId('chart')).toBeInTheDocument();
        expect(screen.queryByText('No subscription data available')).not.toBeInTheDocument();
    });
});
