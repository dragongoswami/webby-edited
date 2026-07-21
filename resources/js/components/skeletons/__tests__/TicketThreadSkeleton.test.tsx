import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TicketThreadSkeleton } from '../TicketThreadSkeleton';

describe('TicketThreadSkeleton', () => {
    it('renders without crashing', () => {
        render(<TicketThreadSkeleton />);
        expect(screen.getByTestId('ticket-thread-skeleton')).toBeInTheDocument();
    });

    it('renders 4 message rows by default', () => {
        render(<TicketThreadSkeleton />);
        const container = screen.getByTestId('ticket-thread-skeleton');
        expect(container.children).toHaveLength(4);
    });

    it('renders a custom count of message rows', () => {
        render(<TicketThreadSkeleton count={7} />);
        const container = screen.getByTestId('ticket-thread-skeleton');
        expect(container.children).toHaveLength(7);
    });
});
