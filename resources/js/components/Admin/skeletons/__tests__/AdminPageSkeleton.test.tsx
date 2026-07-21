import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DetailPageSkeleton } from '../AdminPageSkeleton';

describe('DetailPageSkeleton', () => {
    it('renders detail page skeleton', () => {
        render(<DetailPageSkeleton />);
        expect(screen.getByTestId('detail-page-skeleton')).toBeInTheDocument();
    });

    it('renders user info card', () => {
        render(<DetailPageSkeleton />);
        expect(screen.getByTestId('user-info-card-skeleton')).toBeInTheDocument();
    });

    it('renders subscription details card', () => {
        render(<DetailPageSkeleton />);
        expect(screen.getByTestId('subscription-details-card-skeleton')).toBeInTheDocument();
    });

    it('renders sidebar actions card', () => {
        render(<DetailPageSkeleton />);
        expect(screen.getByTestId('actions-card-skeleton')).toBeInTheDocument();
    });

    it('has 3-column grid layout', () => {
        render(<DetailPageSkeleton data-testid="detail-page-skeleton" />);
        const container = screen.getByTestId('detail-content-skeleton');
        expect(container).toHaveClass('lg:grid-cols-3');
    });
});
