import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AdminPageHeader } from '../AdminPageHeader';

describe('AdminPageHeader', () => {
    it('stacks vertically on mobile and rows out from sm breakpoint up', () => {
        const { container } = render(
            <AdminPageHeader title="Users" subtitle="Manage your users" />
        );

        const root = container.firstElementChild as HTMLElement;
        expect(root).toHaveClass('flex-col');
        expect(root).toHaveClass('sm:flex-row');
        expect(root).toHaveClass('sm:items-center');
        expect(root).toHaveClass('sm:justify-between');
        expect(root).toHaveClass('mb-6');
    });

    it('gives the title block min-w-0 so long titles can truncate/wrap instead of overflowing', () => {
        const { container } = render(
            <AdminPageHeader title="Users" subtitle="Manage your users" />
        );

        const titleBlock = screen.getByText('Users').closest('div');
        expect(titleBlock).toHaveClass('min-w-0');
        expect(container).toBeTruthy();
    });

    it('still renders the title, subtitle and optional action', () => {
        render(
            <AdminPageHeader title="Users" subtitle="Manage your users" action={<button>Add</button>} />
        );

        expect(screen.getByText('Users')).toBeInTheDocument();
        expect(screen.getByText('Manage your users')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });
});
