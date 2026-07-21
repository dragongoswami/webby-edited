import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AiUsageCard } from '../AiUsageCard';
import type { AiUsageStats } from '@/types/admin';

function makeStats(overrides: Partial<AiUsageStats> = {}): AiUsageStats {
    return {
        total_tokens: 0,
        request_count: 0,
        unique_users: 0,
        own_key_users: 0,
        platform_users: 0,
        ...overrides,
    };
}

describe('AiUsageCard', () => {
    afterEach(() => {
        cleanup();
    });

    it('formats token counts in millions/thousands/raw', () => {
        render(<AiUsageCard stats={makeStats({ total_tokens: 1_500_000 })} />);
        expect(screen.getByText('1.5M')).toBeInTheDocument();
        cleanup();

        render(<AiUsageCard stats={makeStats({ total_tokens: 2_500 })} />);
        expect(screen.getByText('2.5K')).toBeInTheDocument();
        cleanup();

        render(<AiUsageCard stats={makeStats({ total_tokens: 500 })} />);
        expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('stat grid is responsive (stacks on mobile, 3-col from sm)', () => {
        render(<AiUsageCard stats={makeStats()} />);

        const grid = screen.getByText('Total Tokens').closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-3');
    });

    it('renders request count with locale grouping, unique users, and API-key user breakdown', () => {
        render(
            <AiUsageCard
                stats={makeStats({
                    request_count: 12345,
                    unique_users: 42,
                    own_key_users: 3,
                    platform_users: 39,
                })}
            />,
        );

        expect(screen.getByText((12345).toLocaleString())).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('3 users')).toBeInTheDocument();
        expect(screen.getByText('39 users')).toBeInTheDocument();
    });
});
