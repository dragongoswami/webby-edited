import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OverviewSkeleton } from '../OverviewSkeleton';

// Breakpoints must exactly mirror the real grids rendered by
// Pages/Admin/Overview.tsx (lines ~94, ~137, ~164, ~187) so the skeleton
// never shifts layout when the real data swaps in.
describe('OverviewSkeleton', () => {
    it('matches the real Overview.tsx stats grid breakpoints', () => {
        const { container } = render(<OverviewSkeleton />);
        const statsGrid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-5');
        expect(statsGrid).not.toBeNull();
    });

    it('matches the real Overview.tsx distribution + AI usage row breakpoints', () => {
        const { container } = render(<OverviewSkeleton />);
        const threeColRows = container.querySelectorAll('.grid.grid-cols-1.lg\\:grid-cols-3');
        // Distribution Charts Row + AI Usage Section
        expect(threeColRows.length).toBe(2);
    });

    it('matches the real Overview.tsx storage section breakpoint', () => {
        const { container } = render(<OverviewSkeleton />);
        const storageGrid = container.querySelector('.grid.grid-cols-1.gap-6');
        expect(storageGrid).not.toBeNull();
    });
});
