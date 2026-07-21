import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { DatabaseCard } from '../DatabaseCard';

// Radix Select needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
    },
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@inertiajs/react', () => ({
    router: {
        put: vi.fn(),
    },
}));

import axios from 'axios';
import { toast } from 'sonner';
import { router } from '@inertiajs/react';

const connections = [
    { id: 1, label: 'Production DB' },
    { id: 2, label: 'Staging DB' },
];

describe('DatabaseCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(axios.get).mockResolvedValue({ data: connections });
    });

    it('fetches the connection library and shows the current connection label', async () => {
        render(<DatabaseCard projectId="proj-1" connectionId={1} canUseDatabase={true} />);

        await waitFor(() => {
            expect(screen.getByText('Production DB')).toBeInTheDocument();
        });
        expect(axios.get).toHaveBeenCalledWith('/supabase-connections');
    });

    it('shows "No database" when nothing is attached', async () => {
        render(<DatabaseCard projectId="proj-1" connectionId={null} canUseDatabase={true} />);

        await waitFor(() => {
            expect(screen.getByText('No database')).toBeInTheDocument();
        });
    });

    it('disables the save button until the selection changes', async () => {
        render(<DatabaseCard projectId="proj-1" connectionId={1} canUseDatabase={true} />);

        await waitFor(() => {
            expect(screen.getByText('Production DB')).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('shows a plan notice when the capability is missing but a connection is attached', async () => {
        render(<DatabaseCard projectId="proj-1" connectionId={1} canUseDatabase={false} />);

        await waitFor(() => {
            expect(screen.getByText('Production DB')).toBeInTheDocument();
        });
        expect(
            screen.getByText('Your plan does not include the database capability. You can still detach the current connection.')
        ).toBeInTheDocument();
    });

    it('surfaces a toast when the connection library fails to load', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('network'));

        render(<DatabaseCard projectId="proj-1" connectionId={null} canUseDatabase={true} />);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalled();
        });
    });

    it('saves a first attach directly without a confirm dialog', async () => {
        const user = userEvent.setup();
        render(<DatabaseCard projectId="proj-1" connectionId={null} canUseDatabase={true} />);

        await waitFor(() => {
            expect(screen.getByText('No database')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('combobox'));
        await user.click(await screen.findByRole('option', { name: /production db/i }));
        await user.click(screen.getByRole('button', { name: /save/i }));

        expect(vi.mocked(router.put)).toHaveBeenCalledWith(
            '/project/proj-1/settings/database',
            { supabase_connection_id: 1 },
            expect.objectContaining({ preserveScroll: true })
        );
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('asks for confirmation before switching connections, then saves', async () => {
        const user = userEvent.setup();
        render(<DatabaseCard projectId="proj-1" connectionId={1} canUseDatabase={true} />);

        await waitFor(() => {
            expect(screen.getByText('Production DB')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('combobox'));
        await user.click(await screen.findByRole('option', { name: /staging db/i }));
        await user.click(screen.getByRole('button', { name: /save/i }));

        // The confirm dialog gates the submit.
        expect(await screen.findByText('Change database?')).toBeInTheDocument();
        expect(vi.mocked(router.put)).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Change database' }));

        expect(vi.mocked(router.put)).toHaveBeenCalledWith(
            '/project/proj-1/settings/database',
            { supabase_connection_id: 2 },
            expect.objectContaining({ preserveScroll: true })
        );
    });
});
