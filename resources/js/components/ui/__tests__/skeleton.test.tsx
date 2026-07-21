import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton } from '../skeleton';

describe('Skeleton', () => {
    it('renders the base classes', () => {
        render(<Skeleton data-testid="skeleton" />);
        const element = screen.getByTestId('skeleton');
        expect(element).toBeInTheDocument();
        expect(element).toHaveClass('bg-accent', 'animate-pulse', 'rounded-md');
    });

    it('is hidden from assistive technology by default', () => {
        render(<Skeleton data-testid="skeleton" />);
        expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true');
    });

    it('disables the pulse animation under prefers-reduced-motion', () => {
        render(<Skeleton data-testid="skeleton" />);
        expect(screen.getByTestId('skeleton')).toHaveClass('motion-reduce:animate-none');
    });

    it('lets callers override aria-hidden via spread props', () => {
        render(<Skeleton data-testid="skeleton" aria-hidden={false} />);
        expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'false');
    });

    it('applies a custom className', () => {
        render(<Skeleton className="custom-class" data-testid="skeleton" />);
        expect(screen.getByTestId('skeleton')).toHaveClass('custom-class');
    });
});
