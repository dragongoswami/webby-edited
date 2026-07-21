import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { SnapshotRollback } from '../SnapshotRollback';

// Radix AlertDialog needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        isAxiosError: vi.fn(),
    },
}));

import axios from 'axios';

const routerReload = vi.fn();

vi.mock('@inertiajs/react', () => ({
    router: {
        reload: (...args: unknown[]) => routerReload(...args),
    },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccess(...args),
        error: (...args: unknown[]) => toastError(...args),
    },
}));

const snapshot1 = {
    id: 1,
    label: 'Before redesign',
    file_count: 42,
    size: '1.2 MB',
    size_bytes: 1200000,
    created_at: new Date().toISOString(),
};

const snapshot2 = {
    id: 2,
    label: 'Initial publish',
    file_count: 10,
    size: '400 KB',
    size_bytes: 400000,
    created_at: new Date().toISOString(),
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('SnapshotRollback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        routerReload.mockClear();
        toastSuccess.mockClear();
        toastError.mockClear();
    });

    it('shows loading (renders nothing) then renders snapshot rows after fetch resolves', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { snapshots: [snapshot1, snapshot2] } });

        const { container } = render(<SnapshotRollback projectId="p1" />);

        // While loading, component renders null.
        expect(container).toBeEmptyDOMElement();

        expect(await screen.findByText('Before redesign')).toBeInTheDocument();
        expect(screen.getByText('Initial publish')).toBeInTheDocument();
        expect(axios.get).toHaveBeenCalledWith('/builder/projects/p1/snapshots');
    });

    it('renders nothing for an empty snapshot list', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { snapshots: [] } });

        const { container } = render(<SnapshotRollback projectId="p1" />);

        await waitFor(() => expect(axios.get).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('silently swallows a fetch error, leaving an empty/no-crash render', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('network down'));

        const { container } = render(<SnapshotRollback projectId="p1" />);

        await waitFor(() => expect(axios.get).toHaveBeenCalled());
        await waitFor(() => expect(container).toBeEmptyDOMElement());
        expect(toastError).not.toHaveBeenCalled();
    });

    it('rolls back a snapshot: confirms via dialog, posts to the rollback URL, toasts success, and reloads', async () => {
        const user = userEvent.setup();
        vi.mocked(axios.get).mockResolvedValue({ data: { snapshots: [snapshot1] } });
        vi.mocked(axios.post).mockResolvedValue({ data: { success: true } });

        render(<SnapshotRollback projectId="p1" />);

        await screen.findByText('Before redesign');

        await user.click(screen.getByRole('button', { name: /Rollback/ }));
        expect(await screen.findByText('Rollback to this version?')).toBeInTheDocument();

        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Rollback' }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/builder/projects/p1/snapshots/1/rollback');
        });
        expect(toastSuccess).toHaveBeenCalledWith('Rolled back successfully');
        expect(routerReload).toHaveBeenCalled();
    });

    it('shows a per-row spinner while rollback is in-flight, and does not post when the dialog is cancelled', async () => {
        const user = userEvent.setup();
        vi.mocked(axios.get).mockResolvedValue({ data: { snapshots: [snapshot1] } });

        const { promise, resolve } = deferred<{ data: unknown }>();
        vi.mocked(axios.post).mockReturnValue(promise as unknown as ReturnType<typeof axios.post>);

        render(<SnapshotRollback projectId="p1" />);
        await screen.findByText('Before redesign');

        // Cancel path: no post call.
        await user.click(screen.getByRole('button', { name: /Rollback/ }));
        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(axios.post).not.toHaveBeenCalled();

        // Confirm path: spinner shows while pending.
        await user.click(screen.getByRole('button', { name: /Rollback/ }));
        const dialog2 = await screen.findByRole('alertdialog');
        await user.click(within(dialog2).getByRole('button', { name: 'Rollback' }));

        await waitFor(() => expect(axios.post).toHaveBeenCalled());
        const rollbackButton = screen.getByRole('button', { name: /Rollback/ });
        expect(rollbackButton).toBeDisabled();
        expect(rollbackButton.querySelector('.animate-spin')).toBeInTheDocument();

        resolve({ data: { success: true } });
        await waitFor(() => expect(rollbackButton).not.toBeDisabled());
    });

    it('shows a toast.error and does not reload when rollback fails', async () => {
        const user = userEvent.setup();
        vi.mocked(axios.get).mockResolvedValue({ data: { snapshots: [snapshot1] } });
        vi.mocked(axios.post).mockRejectedValue(new Error('boom'));

        render(<SnapshotRollback projectId="p1" />);
        await screen.findByText('Before redesign');

        await user.click(screen.getByRole('button', { name: /Rollback/ }));
        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Rollback' }));

        await waitFor(() => expect(toastError).toHaveBeenCalledWith('Rollback failed'));
        expect(routerReload).not.toHaveBeenCalled();

        const rollbackButton = screen.getByRole('button', { name: /Rollback/ });
        expect(rollbackButton).not.toBeDisabled();
    });

    it('deletes a snapshot: confirms via dialog, sends DELETE, and removes the row from the list', async () => {
        const user = userEvent.setup();
        vi.mocked(axios.get).mockResolvedValue({ data: { snapshots: [snapshot1, snapshot2] } });
        vi.mocked(axios.delete).mockResolvedValue({ data: { success: true } });

        render(<SnapshotRollback projectId="p1" />);
        await screen.findByText('Before redesign');

        // Delete buttons are icon-only (no accessible name); target the first row's trash button.
        const row1 = screen.getByText('Before redesign').closest('div.flex.items-center.justify-between') as HTMLElement;
        const deleteButton = within(row1).getAllByRole('button')[1];
        await user.click(deleteButton);

        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('Delete this snapshot?')).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(axios.delete).toHaveBeenCalledWith('/builder/projects/p1/snapshots/1');
        });

        await waitFor(() => expect(screen.queryByText('Before redesign')).not.toBeInTheDocument());
        expect(screen.getByText('Initial publish')).toBeInTheDocument();
    });

    it('shows a toast.error and keeps the row when delete fails', async () => {
        const user = userEvent.setup();
        vi.mocked(axios.get).mockResolvedValue({ data: { snapshots: [snapshot1] } });
        vi.mocked(axios.delete).mockRejectedValue(new Error('boom'));

        render(<SnapshotRollback projectId="p1" />);
        await screen.findByText('Before redesign');

        const row1 = screen.getByText('Before redesign').closest('div.flex.items-center.justify-between') as HTMLElement;
        const deleteButton = within(row1).getAllByRole('button')[1];
        await user.click(deleteButton);

        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(toastError).toHaveBeenCalledWith('Delete failed'));
        expect(screen.getByText('Before redesign')).toBeInTheDocument();
    });

    it('sizes the delete trigger at the h-9 w-9 touch-target floor', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { snapshots: [snapshot1] } });

        render(<SnapshotRollback projectId="p1" />);
        await screen.findByText('Before redesign');

        const row1 = screen.getByText('Before redesign').closest('div.flex.items-center.justify-between') as HTMLElement;
        const deleteButton = within(row1).getAllByRole('button')[1];

        expect(deleteButton.className).toContain('h-9');
        expect(deleteButton.className).toContain('w-9');
    });

    it('targets the correct snapshot id per row when rolling back the second row', async () => {
        const user = userEvent.setup();
        vi.mocked(axios.get).mockResolvedValue({ data: { snapshots: [snapshot1, snapshot2] } });
        vi.mocked(axios.post).mockResolvedValue({ data: { success: true } });

        render(<SnapshotRollback projectId="p1" />);
        await screen.findByText('Before redesign');

        const rollbackButtons = screen.getAllByRole('button', { name: /Rollback/ });
        await user.click(rollbackButtons[1]);

        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Rollback' }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/builder/projects/p1/snapshots/2/rollback');
        });
        expect(axios.post).not.toHaveBeenCalledWith('/builder/projects/p1/snapshots/1/rollback');
    });
});
