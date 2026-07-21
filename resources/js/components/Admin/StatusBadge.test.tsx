import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
    it.each([
        ['active', 'Active'],
        ['inactive', 'Inactive'],
        ['pending', 'Pending'],
        ['completed', 'Completed'],
        ['failed', 'Failed'],
        ['cancelled', 'Cancelled'],
        ['expired', 'Expired'],
        ['refunded', 'Refunded'],
        ['admin', 'Admin'],
        ['user', 'User'],
        ['success', 'Success'],
        ['running', 'Running'],
    ] as const)('renders the translated label for status "%s"', (status, label) => {
        render(<StatusBadge status={status} />);
        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it.each([
        ['active', 'bg-primary/10 text-primary'],
        ['failed', 'bg-destructive/10 text-destructive'],
        ['refunded', 'bg-warning/10 text-warning'],
        ['success', 'bg-success/10 text-success'],
        ['running', 'bg-info/10 text-info'],
        ['user', 'bg-secondary'],
    ] as const)('applies the mapped style classes for status "%s"', (status, expectedStyle) => {
        render(<StatusBadge status={status} />);
        const badge = screen.getByText(
            {
                active: 'Active',
                failed: 'Failed',
                refunded: 'Refunded',
                success: 'Success',
                running: 'Running',
                user: 'User',
            }[status],
        );
        expect(badge.className).toContain(expectedStyle);
    });

    it('appends a passed className alongside the status style', () => {
        render(<StatusBadge status="active" className="my-extra-class" />);
        const badge = screen.getByText('Active');
        expect(badge.className).toContain('bg-primary/10 text-primary');
        expect(badge.className).toContain('my-extra-class');
    });

    it('does not append trailing junk when className is left at its default', () => {
        render(<StatusBadge status="pending" />);
        const badge = screen.getByText('Pending');
        expect(badge.className.trim().endsWith('hover:bg-accent')).toBe(true);
    });

    it('groups statuses that intentionally share the same style', () => {
        render(
            <>
                <StatusBadge status="active" />
                <StatusBadge status="completed" />
                <StatusBadge status="admin" />
            </>,
        );
        const shared = 'bg-primary/10 text-primary';
        expect(screen.getByText('Active').className).toContain(shared);
        expect(screen.getByText('Completed').className).toContain(shared);
        expect(screen.getByText('Admin').className).toContain(shared);
    });

    it('gives distinct groups (destructive vs muted) different styles', () => {
        render(
            <>
                <StatusBadge status="failed" />
                <StatusBadge status="expired" />
            </>,
        );
        expect(screen.getByText('Failed').className).toContain('bg-destructive/10 text-destructive');
        expect(screen.getByText('Expired').className).toContain('bg-muted text-muted-foreground');
        expect(screen.getByText('Failed').className).not.toContain('bg-muted');
    });
});
