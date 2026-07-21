import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomDomainCard } from '../CustomDomainCard';
import type { CustomDomainSettings } from '../ProjectSettingsPanel';

// --- Mocks ---

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
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
        reload: vi.fn(),
    },
    Link: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
        <a {...props}>{children}</a>
    ),
}));

import axios from 'axios';
import { toast } from 'sonner';
import { router } from '@inertiajs/react';

// --- Helpers ---

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const defaultCustomDomain: CustomDomainSettings = {
    enabled: true,
    canCreateMore: true,
    usage: {
        used: 0,
        limit: 3,
        unlimited: false,
        remaining: 3,
    },
    baseDomain: 'example.com',
};

function renderCard(projectOverrides = {}, domainOverrides = {}) {
    const project = {
        id: 'proj-123',
        custom_domain: 'my.domain.com',
        custom_domain_verified: true,
        custom_domain_ssl_status: 'pending' as string | null,
        ...projectOverrides,
    };

    const customDomain: CustomDomainSettings = {
        ...defaultCustomDomain,
        ...domainOverrides,
    };

    return render(
        <CustomDomainCard project={project} customDomain={customDomain} />
    );
}

// --- Test Suite ---

describe('CustomDomainCard SSL Polling', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.spyOn(Math, 'random').mockReturnValue(0);

        // Default: instructions endpoint returns pending (used by the load-instructions effect)
        vi.mocked(axios.get).mockResolvedValue({
            data: { success: true, ssl_status: 'pending' },
        });

        // Default: verify endpoint returns not-yet-verified (used by auto-verify polling)
        vi.mocked(axios.post).mockResolvedValue({
            data: { success: false },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ---- SSL Polling Activation ----

    describe('SSL Polling Activation', () => {
        it('does not start SSL polling when domain is not verified', async () => {
            renderCard({
                custom_domain_verified: false,
                custom_domain_ssl_status: 'pending',
            });

            vi.mocked(axios.get).mockClear();

            await act(async () => {
                vi.advanceTimersByTime(40000);
                await flushPromises();
            });

            const sslPollingCalls = vi.mocked(axios.get).mock.calls.filter(
                (call) => typeof call[0] === 'string' && call[0].includes('/domain/instructions')
            );
            expect(sslPollingCalls.length).toBe(0);
        });

        it('does not start SSL polling when SSL is already active', async () => {
            renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'active',
            });

            vi.mocked(axios.get).mockClear();

            await act(async () => {
                vi.advanceTimersByTime(40000);
                await flushPromises();
            });

            const sslPollingCalls = vi.mocked(axios.get).mock.calls.filter(
                (call) => typeof call[0] === 'string' && call[0].includes('/domain/instructions')
            );
            expect(sslPollingCalls.length).toBe(0);
        });

        it('does not start SSL polling when SSL has failed', async () => {
            renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'failed',
            });

            vi.mocked(axios.get).mockClear();

            await act(async () => {
                vi.advanceTimersByTime(40000);
                await flushPromises();
            });

            const sslPollingCalls = vi.mocked(axios.get).mock.calls.filter(
                (call) => typeof call[0] === 'string' && call[0].includes('/domain/instructions')
            );
            expect(sslPollingCalls.length).toBe(0);
        });

        it('starts SSL polling when verified and SSL is pending', async () => {
            vi.mocked(axios.get).mockResolvedValue({
                data: { success: true, ssl_status: 'pending' },
            });

            renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'pending',
            });

            await act(async () => {
                vi.advanceTimersByTime(31000);
                await flushPromises();
            });

            expect(vi.mocked(axios.get)).toHaveBeenCalledWith(
                expect.stringContaining('/project/proj-123/domain/instructions')
            );
        });
    });

    // ---- SSL Polling Behavior ----

    describe('SSL Polling Behavior', () => {
        it('calls router.reload when SSL becomes active', async () => {
            vi.mocked(axios.get).mockResolvedValue({
                data: { success: true, ssl_status: 'active' },
            });

            renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'pending',
            });

            await act(async () => {
                vi.advanceTimersByTime(31000);
                await flushPromises();
            });

            expect(router.reload).toHaveBeenCalled();
            expect(toast.success).toHaveBeenCalled();
        });

        it('calls router.reload when SSL fails', async () => {
            vi.mocked(axios.get).mockResolvedValue({
                data: { success: true, ssl_status: 'failed' },
            });

            renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'pending',
            });

            await act(async () => {
                vi.advanceTimersByTime(31000);
                await flushPromises();
            });

            expect(router.reload).toHaveBeenCalled();
            expect(toast.error).toHaveBeenCalled();
        });

        it('stops polling after 15-minute timeout', async () => {
            vi.mocked(axios.get).mockResolvedValue({
                data: { success: true, ssl_status: 'pending' },
            });

            renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'pending',
            });

            // Advance past the 15-minute timeout
            await act(async () => {
                vi.advanceTimersByTime(16 * 60 * 1000);
                await flushPromises();
            });

            vi.mocked(axios.get).mockClear();

            // Advance another interval
            await act(async () => {
                vi.advanceTimersByTime(31000);
                await flushPromises();
            });

            const sslPollingCalls = vi.mocked(axios.get).mock.calls.filter(
                (call) => typeof call[0] === 'string' && call[0].includes('/domain/instructions')
            );
            expect(sslPollingCalls.length).toBe(0);
        });

        it('cleans up interval on unmount', async () => {
            const { unmount } = renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'pending',
            });

            vi.mocked(axios.get).mockClear();

            unmount();

            await act(async () => {
                vi.advanceTimersByTime(31000);
                await flushPromises();
            });

            const sslPollingCalls = vi.mocked(axios.get).mock.calls.filter(
                (call) => typeof call[0] === 'string' && call[0].includes('/domain/instructions')
            );
            expect(sslPollingCalls.length).toBe(0);
        });
    });

    // ---- UI ----

    describe('UI', () => {
        it('renders SSL provisioning UI without overlapping layout', () => {
            renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'pending',
            });

            expect(screen.getByText('SSL Certificate Provisioning')).toBeInTheDocument();

            // The Loader2 icon in the SSL provisioning section should NOT have "absolute"
            // as a standalone class -- it uses "absolute" only as part of a positioned
            // overlay on the Lock icon, not as a top-level layout class that could cause overlap.
            const loader2Icons = document.querySelectorAll('.animate-spin');
            const sslLoader = Array.from(loader2Icons).find(
                (el) => el.closest('.rounded-lg.border.p-4.bg-muted\\/50')
            );

            // If the loader exists in the SSL section, verify it doesn't have standalone "absolute"
            // that would cause layout overlap issues
            if (sslLoader) {
                expect(sslLoader.classList.contains('absolute')).toBe(false);
            }
        });

        it('shows retry button when SSL has failed', () => {
            renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'failed',
            });

            expect(screen.getByText('SSL Provisioning Failed')).toBeInTheDocument();
            expect(screen.getByText('Retry SSL Provisioning')).toBeInTheDocument();
            expect(screen.getByText('Remove Domain')).toBeInTheDocument();
        });

        it('retry button calls retry-ssl endpoint and reloads on success', async () => {
            const axios = (await import('axios')).default;
            const { toast } = await import('sonner');
            const { router } = await import('@inertiajs/react');

            vi.mocked(axios.post).mockResolvedValueOnce({
                data: { success: true, message: 'Queued' },
            });

            renderCard({
                custom_domain_verified: true,
                custom_domain_ssl_status: 'failed',
            });

            const retryButton = screen.getByText('Retry SSL Provisioning');
            await act(async () => {
                retryButton.click();
            });

            expect(axios.post).toHaveBeenCalledWith('/project/proj-123/domain/retry-ssl');
            expect(toast.success).toHaveBeenCalled();
            expect(router.reload).toHaveBeenCalled();
        });

        it('renders a row per record when instructions return multiple A records', async () => {
            vi.mocked(axios.get).mockResolvedValueOnce({
                data: {
                    success: true,
                    instructions: {
                        method: 'a_record',
                        records: [
                            { type: 'A', host: 'mysite.com', value: '1.2.3.4' },
                            { type: 'A', host: 'www.mysite.com', value: '1.2.3.4' },
                        ],
                    },
                    ssl_status: null,
                },
            });

            renderCard({
                custom_domain: 'mysite.com',
                custom_domain_verified: false,
                custom_domain_ssl_status: null,
            });

            await act(async () => {
                await flushPromises();
            });

            expect(screen.getByText('Add these A records:')).toBeInTheDocument();
            expect(screen.getByText('mysite.com')).toBeInTheDocument();
            expect(screen.getByText('www.mysite.com')).toBeInTheDocument();
            // Value is shown twice (once per record row)
            const values = screen.getAllByText('1.2.3.4');
            expect(values.length).toBe(2);
        });

        it('stacks each DNS record row below sm, with full-width code and accessible h-9 w-9 copy buttons', async () => {
            vi.mocked(axios.get).mockResolvedValueOnce({
                data: {
                    success: true,
                    instructions: {
                        method: 'a_record',
                        records: [{ type: 'A', host: 'mysite.com', value: '1.2.3.4' }],
                    },
                    ssl_status: null,
                },
            });

            renderCard({
                custom_domain: 'mysite.com',
                custom_domain_verified: false,
                custom_domain_ssl_status: null,
            });

            await act(async () => {
                await flushPromises();
            });

            const row = screen.getByText('mysite.com').closest(
                'div.flex.flex-col.gap-2.sm\\:grid.sm\\:grid-cols-3'
            ) as HTMLElement;
            expect(row).toBeTruthy();

            const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
            expect(copyButtons.length).toBe(2); // host + value

            copyButtons.forEach((btn) => {
                expect(btn.className).toContain('h-9');
                expect(btn.className).toContain('w-9');
            });
        });
    });
});
