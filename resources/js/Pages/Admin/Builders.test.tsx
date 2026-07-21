import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import type { User } from '@/types';

vi.mock('axios', () => ({
    default: { get: vi.fn(() => Promise.reject(new Error('offline'))) },
}));

// Radix Dialog needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('@inertiajs/react', () => ({
    router: {
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        on: vi.fn(() => vi.fn()),
    },
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const user: User = { id: 1, name: 'Admin', email: 'admin@example.com' } as User;

import Builders from './Builders';

describe('Admin/Builders — server key masking', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks keeps mockImplementations — reset axios.get's explicitly
        // so a per-test resolver can't leak into later tests.
        vi.mocked(axios.get).mockReset();
        vi.mocked(axios.get).mockImplementation(() => Promise.reject(new Error('offline')));
    });

    afterEach(() => {
        // The copy test redefines navigator.clipboard; drop it so later tests
        // (and files) see jsdom's default again.
        delete (navigator as { clipboard?: unknown }).clipboard;
    });

    it('the Add dialog server key field defaults masked (type="password")', () => {
        render(<Builders user={user} builders={[]} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add AI Builder' }));

        const input = screen.getByLabelText('Server Key') as HTMLInputElement;
        expect(input).toHaveAttribute('type', 'password');
    });

    it('the reveal toggle shows and hides the Add dialog server key', () => {
        render(<Builders user={user} builders={[]} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add AI Builder' }));

        const dialog = screen.getByRole('dialog');
        const input = within(dialog).getByLabelText('Server Key') as HTMLInputElement;

        fireEvent.click(within(dialog).getByRole('button', { name: 'Show secret' }));
        expect(input).toHaveAttribute('type', 'text');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Hide secret' }));
        expect(input).toHaveAttribute('type', 'password');
    });

    it('Add dialog: URL/Port grid is responsive (stacks on mobile, 2-col from sm)', () => {
        render(<Builders user={user} builders={[]} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add AI Builder' }));

        const dialog = screen.getByRole('dialog');
        const grid = within(dialog).getByLabelText('URL').closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('the Edit dialog server key field also defaults masked (type="password")', () => {
        const builder = {
            id: 1,
            name: 'Primary',
            url: 'http://localhost',
            port: 8080,
            max_iterations: 20,
            is_active: true,
            created_at: '2026-01-01',
            projects_count: 0,
        };
        render(<Builders user={user} builders={[builder]} />);

        const rows = screen.getAllByRole('row');
        const dataRow = rows.find((r) => within(r).queryByText('Primary'));
        expect(dataRow).toBeDefined();

        // Open the row action menu, then click Edit.
        fireEvent.click(within(dataRow!).getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByText('Edit'));

        const input = screen.getByLabelText('Server Key') as HTMLInputElement;
        expect(input).toHaveAttribute('type', 'password');
    });

    it('Edit dialog: URL/Port grid is responsive (stacks on mobile, 2-col from sm)', () => {
        const builder = {
            id: 1,
            name: 'Primary',
            url: 'http://localhost',
            port: 8080,
            max_iterations: 20,
            is_active: true,
            created_at: '2026-01-01',
            projects_count: 0,
        };
        render(<Builders user={user} builders={[builder]} />);

        const rows = screen.getAllByRole('row');
        const dataRow = rows.find((r) => within(r).queryByText('Primary'));
        fireEvent.click(within(dataRow!).getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByText('Edit'));

        const dialog = screen.getByRole('dialog');
        const grid = within(dialog).getByLabelText('URL').closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('Add dialog: submitting disables the buttons and shows a pending label while the request is in flight', () => {
        render(<Builders user={user} builders={[]} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add AI Builder' }));
        const dialog = screen.getByRole('dialog');

        fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Primary' } });
        fireEvent.change(within(dialog).getByLabelText('Server Key'), { target: { value: 'sk-test' } });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Add AI Builder' }));

        // router.post is mocked and never invokes onFinish, so isSubmitting stays
        // true — both buttons must now be disabled and show the pending label.
        expect(within(dialog).getByRole('button', { name: 'Saving...' })).toBeDisabled();
        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('Copy Key fetches the server key on demand (never present in props) and copies it', async () => {
        const builder = {
            id: 1,
            name: 'Primary',
            url: 'http://localhost',
            port: 8080,
            max_iterations: 20,
            is_active: true,
            created_at: '2026-01-01',
            projects_count: 0,
        };
        vi.mocked(axios.get).mockImplementation((url: string) =>
            url.includes('reveal-key')
                ? Promise.resolve({ data: { server_key: 'fetched-secret-key' } })
                : Promise.reject(new Error('offline'))
        );
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

        render(<Builders user={user} builders={[builder]} />);

        const rows = screen.getAllByRole('row');
        const dataRow = rows.find((r) => within(r).queryByText('Primary'));
        fireEvent.click(within(dataRow!).getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByText('Copy Key'));

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith('fetched-secret-key');
        });
        expect(vi.mocked(axios.get).mock.calls.some(([url]) => String(url).includes('reveal-key'))).toBe(true);
    });

    it('Delete confirm: confirming disables the action button and shows a pending label while the request is in flight', () => {
        const builder = {
            id: 1,
            name: 'Primary',
            url: 'http://localhost',
            port: 8080,
            max_iterations: 20,
            is_active: true,
            created_at: '2026-01-01',
            projects_count: 0,
        };
        render(<Builders user={user} builders={[builder]} />);

        const rows = screen.getAllByRole('row');
        const dataRow = rows.find((r) => within(r).queryByText('Primary'));
        fireEvent.click(within(dataRow!).getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByText('Delete'));

        const dialog = screen.getByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        // Re-query from the live document: Radix's AlertDialogAction auto-closes
        // unless the handler preventDefault()s, so asserting on the captured node
        // would false-positive against a detached subtree.
        const liveDialog = screen.getByRole('alertdialog');
        expect(liveDialog).toBeInTheDocument();
        expect(within(liveDialog).getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    });
});
