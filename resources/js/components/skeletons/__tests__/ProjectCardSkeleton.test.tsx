import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProjectCardSkeleton } from '../ProjectCardSkeleton';

describe('ProjectCardSkeleton', () => {
    it('renders card container', () => {
        render(<ProjectCardSkeleton />);
        expect(screen.getByTestId('project-card-skeleton')).toBeInTheDocument();
    });

    it('renders thumbnail placeholder', () => {
        render(<ProjectCardSkeleton />);
        expect(screen.getByTestId('project-card-thumbnail-skeleton')).toBeInTheDocument();
    });

    it('renders title placeholder', () => {
        render(<ProjectCardSkeleton />);
        expect(screen.getByTestId('project-card-title-skeleton')).toBeInTheDocument();
    });

    it('renders meta placeholder', () => {
        render(<ProjectCardSkeleton />);
        expect(screen.getByTestId('project-card-meta-skeleton')).toBeInTheDocument();
    });

    it('renders in grid mode by default with a 4:3 borderless thumbnail', () => {
        render(<ProjectCardSkeleton />);
        const thumbnail = screen.getByTestId('project-card-thumbnail-skeleton');
        // Mirrors the real grid card: aspect-[4/3] rounded-xl border bg-card
        expect(thumbnail).toHaveClass('aspect-[4/3]', 'rounded-xl', 'border');
    });

    it('renders in list mode when specified', () => {
        render(<ProjectCardSkeleton viewMode="list" />);
        const thumbnail = screen.getByTestId('project-card-thumbnail-skeleton');
        // List mode has different dimensions
        expect(thumbnail).toHaveClass('h-16', 'w-24');
    });

    it('renders in large mode with a 4:3 borderless thumbnail', () => {
        render(<ProjectCardSkeleton viewMode="large" />);
        const thumbnail = screen.getByTestId('project-card-thumbnail-skeleton');
        expect(thumbnail).toHaveClass('aspect-[4/3]', 'rounded-xl', 'border');
    });
});
