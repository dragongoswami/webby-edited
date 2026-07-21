import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { CronLogsTable } from '../CronLogsTable';
import type { CronLog, Cronjob } from '@/types/admin';

// useAppDate reads Inertia's usePage(), which isn't wired up in this render tree.
// A passthrough formatter keeps the assertions about *content presence* honest
// without pulling in an Inertia page-props mock unrelated to this component's behavior.
vi.mock('@/lib/date', () => ({
    useAppDate: () => ({
        formatDateTime: (value: string | null | undefined) => value ?? '-',
    }),
}));

// Radix Select needs these pointer APIs, which jsdom doesn't implement (iter-70 idiom).
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const jobs: Cronjob[] = [
    {
        name: 'SendDigest',
        class: 'App\\Jobs\\SendDigest',
        command: 'send:digest',
        schedule: 'daily',
        cron: '0 0 * * *',
        description: '',
        last_run: null,
        last_status: 'success',
        next_run: '',
    },
    {
        name: 'PruneLogs',
        class: 'App\\Jobs\\PruneLogs',
        command: 'prune:logs',
        schedule: 'daily',
        cron: '0 1 * * *',
        description: '',
        last_run: null,
        last_status: 'success',
        next_run: '',
    },
];

const makeLog = (overrides: Partial<CronLog> = {}): CronLog => ({
    id: 1,
    job_name: 'SendDigest',
    job_class: 'App\\Jobs\\SendDigest',
    status: 'success',
    started_at: '2026-07-01T10:00:00Z',
    completed_at: '2026-07-01T10:00:05Z',
    duration: 5,
    human_duration: '5s',
    triggered_by: 'schedule',
    trigger_display: 'Scheduled',
    message: null,
    exception: null,
    created_at: '2026-07-01T10:00:00Z',
    ...overrides,
});

function jsonResponse(body: unknown): Promise<Response> {
    return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
    } as Response);
}

function page(
    data: CronLog[],
    overrides: Partial<{ total: number; last_page: number }> = {}
) {
    return {
        data,
        current_page: 1,
        last_page: overrides.last_page ?? 1,
        per_page: 10,
        total: overrides.total ?? data.length,
    };
}

describe('CronLogsTable', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockImplementation(() => jsonResponse(page([makeLog()])));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const lastUrl = () => {
        const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
        return call[0] as string;
    };

    it('fetches on mount with default page/per_page params, showing a loading state before rows render', async () => {
        let resolveFetch: (value: Response) => void = () => {};
        fetchMock.mockImplementationOnce(
            () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
        );

        const { container } = render(<CronLogsTable jobs={jobs} />);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(lastUrl()).toBe('/admin.cronjobs.logs?page=1&per_page=10');
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
        expect(screen.queryByText('SendDigest')).not.toBeInTheDocument();

        resolveFetch({
            ok: true,
            json: () => Promise.resolve(page([makeLog()])),
        } as Response);

        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());
        expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('renders the correct badge label + class per statusConfig for each status', async () => {
        fetchMock.mockImplementation(() =>
            jsonResponse(
                page([
                    makeLog({ id: 1, status: 'success', job_name: 'SendDigest' }),
                    makeLog({ id: 2, status: 'failed', job_name: 'PruneLogs' }),
                    makeLog({ id: 3, status: 'running', job_name: 'Backup' }),
                ])
            )
        );

        render(<CronLogsTable jobs={jobs} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());

        const successBadge = screen.getByText('Success').closest('.inline-flex') as HTMLElement;
        expect(successBadge.className).toContain('bg-success/10');
        expect(successBadge.className).toContain('text-success');

        const failedBadge = screen.getByText('Failed').closest('.inline-flex') as HTMLElement;
        expect(failedBadge.className).toContain('bg-destructive/10');
        expect(failedBadge.className).toContain('text-destructive');

        const runningBadge = screen.getByText('Running').closest('.inline-flex') as HTMLElement;
        expect(runningBadge.className).toContain('bg-info/10');
        expect(runningBadge.querySelector('svg.lucide-loader-circle')?.getAttribute('class')).toContain(
            'animate-spin'
        );
    });

    it('refetches with a status param when the status filter changes', async () => {
        const user = userEvent.setup();
        render(<CronLogsTable jobs={jobs} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());
        fetchMock.mockClear();

        await user.click(screen.getAllByRole('combobox')[0]);
        await user.click(await screen.findByRole('option', { name: 'Failed' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(lastUrl()).toContain('status=failed');
        expect(lastUrl()).toContain('page=1');
    });

    it('refetches with a job param when the job filter changes', async () => {
        const user = userEvent.setup();
        render(<CronLogsTable jobs={jobs} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());
        fetchMock.mockClear();

        await user.click(screen.getAllByRole('combobox')[1]);
        await user.click(await screen.findByRole('option', { name: 'PruneLogs' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(lastUrl()).toContain('job=PruneLogs');
    });

    it('refetches with a search param when the search input changes', async () => {
        render(<CronLogsTable jobs={jobs} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());
        fetchMock.mockClear();

        fireEvent.change(screen.getByPlaceholderText('Search logs...'), {
            target: { value: 'digest' },
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(lastUrl()).toContain('search=digest');
    });

    it('paginates via the real TanStackDataTable, requesting 1-based pages from 0-based state', async () => {
        fetchMock.mockImplementation(() =>
            jsonResponse(page([makeLog()], { total: 25, last_page: 3 }))
        );
        render(<CronLogsTable jobs={jobs} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
        fetchMock.mockClear();

        fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(lastUrl()).toContain('page=2');
    });

    it('refetches when the refresh button is clicked', async () => {
        render(<CronLogsTable jobs={jobs} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());
        fetchMock.mockClear();

        const refreshButton = document
            .querySelector('svg.lucide-refresh-cw')!
            .closest('button') as HTMLElement;
        fireEvent.click(refreshButton);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });

    it('refetches when the refreshKey prop changes', async () => {
        const { rerender } = render(<CronLogsTable jobs={jobs} refreshKey={1} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());
        fetchMock.mockClear();

        rerender(<CronLogsTable jobs={jobs} refreshKey={2} />);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });

    it('the view-details and refresh buttons have accessible names, and refresh reports aria-busy while loading', async () => {
        fetchMock.mockImplementation(() =>
            jsonResponse(page([makeLog({ message: 'Digest sent' })]))
        );
        render(<CronLogsTable jobs={jobs} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());

        expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();

        const refreshButton = screen.getByRole('button', { name: 'Refresh' });
        expect(refreshButton).toHaveAttribute('aria-busy', 'false');

        let resolveFetch: (value: Response) => void = () => {};
        fetchMock.mockImplementationOnce(
            () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
        );
        fireEvent.click(refreshButton);

        expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-busy', 'true');

        resolveFetch({ ok: true, json: () => Promise.resolve(page([makeLog()])) } as Response);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-busy', 'false'));
    });

    it('opens the log details dialog via the Eye button and closes it', async () => {
        fetchMock.mockImplementation(() =>
            jsonResponse(
                page([
                    makeLog({
                        job_name: 'SendDigest',
                        message: 'Digest sent to 12 subscribers',
                        exception: null,
                    }),
                ])
            )
        );
        render(<CronLogsTable jobs={jobs} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());

        const eyeButton = document.querySelector('svg.lucide-eye')!.closest('button') as HTMLElement;
        fireEvent.click(eyeButton);

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText(/Log Details/)).toBeInTheDocument();
        expect(within(dialog).getByText('Digest sent to 12 subscribers')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('shows the translated status label (not the raw enum value) in the details dialog', async () => {
        fetchMock.mockImplementation(() =>
            jsonResponse(
                page([
                    makeLog({ status: 'success', job_name: 'SendDigest', message: 'Digest sent' }),
                ])
            )
        );
        render(<CronLogsTable jobs={jobs} />);
        await waitFor(() => expect(screen.getByText('SendDigest')).toBeInTheDocument());

        const eyeButton = document.querySelector('svg.lucide-eye')!.closest('button') as HTMLElement;
        fireEvent.click(eyeButton);

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Success')).toBeInTheDocument();
        expect(within(dialog).queryByText('success')).not.toBeInTheDocument();
    });

    it('shows an empty-state row when the server returns no logs', async () => {
        fetchMock.mockImplementation(() => jsonResponse(page([])));

        render(<CronLogsTable jobs={jobs} />);

        expect(await screen.findByText('No results.')).toBeInTheDocument();
    });

    it('does not throw and falls back to the empty state when the fetch fails', async () => {
        fetchMock.mockImplementation(() => Promise.reject(new Error('network down')));

        expect(() => render(<CronLogsTable jobs={jobs} />)).not.toThrow();

        expect(await screen.findByText('No results.')).toBeInTheDocument();
    });
});
