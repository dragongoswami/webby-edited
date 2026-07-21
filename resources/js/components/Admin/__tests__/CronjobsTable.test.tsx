import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { CronjobsTable } from '../CronjobsTable';
import type { Cronjob } from '@/types/admin';
import { toast } from 'sonner';
import { router } from '@inertiajs/react';

// useAppDate reads Inertia's usePage(), which isn't wired up in this render tree.
// A passthrough formatter keeps assertions about *content presence* honest
// without pulling in an Inertia page-props mock unrelated to this component's behavior.
vi.mock('@/lib/date', () => ({
    useAppDate: () => ({
        formatDateTime: (value: string | null | undefined) => value ?? '-',
    }),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@inertiajs/react', () => ({
    router: {
        reload: vi.fn(),
    },
}));

// Radix/TanStack controls need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    (globalThis as { route: (name: string) => string }).route = (name: string) => '/' + name;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

const makeJob = (overrides: Partial<Cronjob> = {}): Cronjob => ({
    name: 'SendDigest',
    class: 'App\\Jobs\\SendDigest',
    command: 'send:digest',
    schedule: 'daily',
    cron: '0 0 * * *',
    description: 'Sends the daily digest email',
    last_run: null,
    last_status: 'success',
    next_run: '2026-07-05T00:00:00Z',
    ...overrides,
});

const getRowFor = (jobName: string): HTMLElement =>
    screen.getByText(jobName).closest('tr') as HTMLElement;

describe('CronjobsTable', () => {
    it('renders job rows with status badges', () => {
        const jobs = [
            makeJob({ name: 'SendDigest', command: 'send:digest', last_status: 'success' }),
            makeJob({ name: 'PruneLogs', command: 'prune:logs', last_status: 'failed' }),
            makeJob({ name: 'Backup', command: 'backup:run', last_status: 'running' }),
        ];

        render(<CronjobsTable jobs={jobs} />);

        expect(screen.getByText('SendDigest')).toBeInTheDocument();

        const successRow = getRowFor('SendDigest');
        expect(within(successRow).getByText('Success')).toBeInTheDocument();

        const failedRow = getRowFor('PruneLogs');
        expect(within(failedRow).getByText('Failed')).toBeInTheDocument();

        const runningRow = getRowFor('Backup');
        expect(within(runningRow).getByText('Running')).toBeInTheDocument();
        const runningIcon = within(runningRow).getByText('Running').parentElement?.querySelector('svg');
        expect(runningIcon).toHaveClass('animate-spin');
    });

    it('shows Never when a job has no last_run', () => {
        const jobs = [
            makeJob({ name: 'NoRunYet', command: 'no:run', last_run: null }),
            makeJob({ name: 'HasRun', command: 'has:run', last_run: '2026-06-01T00:00:00Z' }),
        ];

        render(<CronjobsTable jobs={jobs} />);

        const neverRow = getRowFor('NoRunYet');
        expect(within(neverRow).getByText('Never')).toBeInTheDocument();

        const hasRunRow = getRowFor('HasRun');
        expect(within(hasRunRow).getByText('2026-06-01T00:00:00Z')).toBeInTheDocument();
    });

    it('disables the trigger button for a running job', () => {
        const jobs = [
            makeJob({ name: 'RunningJob', command: 'running:job', last_status: 'running' }),
            makeJob({ name: 'IdleJob', command: 'idle:job', last_status: 'success' }),
        ];

        render(<CronjobsTable jobs={jobs} />);

        const runningRow = getRowFor('RunningJob');
        expect(within(runningRow).getByRole('button', { name: /Run Now/ })).toBeDisabled();

        const idleRow = getRowFor('IdleJob');
        expect(within(idleRow).getByRole('button', { name: /Run Now/ })).toBeEnabled();
    });

    it('triggers a job and shows success', async () => {
        fetchMock.mockResolvedValue({ json: async () => ({ success: true }) });
        const onJobTriggered = vi.fn();
        const jobs = [makeJob({ name: 'SendDigest', command: 'send:digest', last_status: 'success' })];

        render(<CronjobsTable jobs={jobs} onJobTriggered={onJobTriggered} />);

        const row = getRowFor('SendDigest');
        fireEvent.click(within(row).getByRole('button', { name: /Run Now/ }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('/admin.cronjobs.trigger');
        expect(JSON.parse(options.body).command).toBe('send:digest');

        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(onJobTriggered).toHaveBeenCalledTimes(1);
        expect(router.reload).toHaveBeenCalledWith({ only: ['cronjobs'] });
    });

    it('shows an error toast when the trigger fails', async () => {
        fetchMock.mockResolvedValue({ json: async () => ({ success: false, message: 'boom' }) });
        const jobs = [makeJob({ name: 'SendDigest', command: 'send:digest', last_status: 'success' })];

        render(<CronjobsTable jobs={jobs} />);

        const row = getRowFor('SendDigest');
        fireEvent.click(within(row).getByRole('button', { name: /Run Now/ }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('boom'));
    });

    it('shows the next_run relative time in days for a future date', () => {
        const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();
        const jobs = [makeJob({ name: 'FutureJob', command: 'future:job', next_run: future })];

        render(<CronjobsTable jobs={jobs} />);

        const row = getRowFor('FutureJob');
        expect(within(row).getByText('in 2 days')).toBeInTheDocument();
    });
});
