import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UpdatesTab from './UpdatesTab';

vi.mock('@inertiajs/react', () => ({
    router: { reload: vi.fn() },
    // Null broadcastConfig/userId makes the realtime Echo effect a no-op in tests.
    usePage: () => ({ props: { broadcastConfig: null, auth: { user: null } } }),
}));
vi.mock('@/contexts/LanguageContext', () => ({ useTranslation: () => ({ t: (s: string) => s }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Ziggy's route() is a global in the app; stub it for tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).route = (name: string) => name;

const base = {
    current_version: '1.2.4',
    update_available: false,
    latest: null,
    changelog: null,
    purchase_code_configured: true,
    auto_apply: false,
    builders: [],
};

function mockStatus(status: object) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => status });
}

beforeEach(() => {
    mockStatus({ state: 'idle' });
});

describe('UpdatesTab', () => {
    it('shows up-to-date state', () => {
        render(<UpdatesTab settings={{ ...base, current_version: '1.2.4', update_available: false }} />);
        expect(screen.getByText(/up to date/i)).toBeTruthy();
    });

    it('shows available state with version', () => {
        render(<UpdatesTab settings={{ ...base, update_available: true, latest: '1.2.5', changelog: 'notes' }} />);
        expect(screen.getByText(/1\.2\.5/)).toBeTruthy();
    });

    it('lists builders with drift badge and update control', () => {
        render(
            <UpdatesTab
                settings={{
                    ...base,
                    current_version: '1.2.5',
                    builders: [
                        { id: 1, name: 'Primary', url: 'http://b1:8080', version: '1.2.4', drift: true },
                        { id: 2, name: 'Backup', url: 'http://b2:8080', version: '1.2.5', drift: false },
                    ],
                }}
            />
        );
        expect(screen.getByText('Primary')).toBeTruthy();
        expect(screen.getAllByText(/out of date|update/i).length).toBeGreaterThan(0);
    });

    it('resumes the progress UI when an update is already running (e.g. after a reload)', async () => {
        mockStatus({ state: 'updating', phase: 'migrate', percent: 65, message: 'Running migrations' });
        render(<UpdatesTab settings={{ ...base, update_available: true, latest: '1.2.5' }} />);

        // The reload-warning + live progress replace the normal "Update now" view.
        expect(await screen.findByText(/Update in progress/i)).toBeTruthy();
        expect(screen.getByText(/don’t reload or close this tab/i)).toBeTruthy();
        expect(screen.getByText(/Running migrations/i)).toBeTruthy();
        expect(screen.getByText('65%')).toBeTruthy();
    });

    it('does not hijack the view on mount for a stale success state', async () => {
        mockStatus({ state: 'success', percent: 100, message: 'Update complete' });
        render(<UpdatesTab settings={{ ...base, update_available: true, latest: '1.2.5' }} />);
        // success is not an in-progress state, so the normal "Update now" view stays.
        await waitFor(() => expect(screen.getByText(/Update now/i)).toBeTruthy());
        expect(screen.queryByText(/Reload page/i)).toBeNull();
    });

    it('keeps waiting (does not show failure) when the status endpoint 503s mid-update', async () => {
        vi.useFakeTimers();
        try {
            const updating = { ok: true, json: async () => ({ state: 'updating', percent: 50, message: 'Running migrations' }) };
            const down = { ok: false, status: 503, json: async () => ({}) };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (global as any).fetch = vi.fn().mockResolvedValueOnce(updating).mockResolvedValue(down);
            render(<UpdatesTab settings={{ ...base, update_available: true, latest: '1.2.5' }} />);
            await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // mount fetch → running
            expect(screen.getByText(/Update in progress/i)).toBeTruthy();
            await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); // first poll tick → 503
            expect(screen.getByText(/temporarily offline/i)).toBeTruthy();
            expect(screen.queryByText(/Update failed/i)).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('shows the reload prompt once the update reports success', async () => {
        vi.useFakeTimers();
        try {
            const updating = { ok: true, json: async () => ({ state: 'updating', percent: 65, message: 'Running migrations' }) };
            // No message → AlertDescription falls back, so "Update complete" (the title) is unique.
            const success = { ok: true, json: async () => ({ state: 'success', percent: 100 }) };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (global as any).fetch = vi.fn().mockResolvedValueOnce(updating).mockResolvedValue(success);
            render(<UpdatesTab settings={{ ...base, update_available: true, latest: '1.2.5' }} />);
            await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // mount → running (updating)
            expect(screen.getByText(/Update in progress/i)).toBeTruthy();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3000); // poll tick
                await vi.advanceTimersByTimeAsync(0); // flush the async json() resolution
            });
            expect(screen.getByText(/Update complete/i)).toBeTruthy();
            expect(screen.getByText(/Reload page/i)).toBeTruthy();
        } finally {
            vi.useRealTimers();
        }
    });
});
