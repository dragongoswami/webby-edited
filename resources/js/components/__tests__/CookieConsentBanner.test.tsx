import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CookieConsentBanner from '../CookieConsentBanner';

let pageProps: Record<string, unknown>;
const routerPost = vi.fn();

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
    router: { post: (...args: unknown[]) => routerPost(...args) },
}));

/** Advances past the component's 1000ms show-delay and flushes the resulting state update. */
function advancePastShowDelay() {
    act(() => {
        vi.advanceTimersByTime(1100);
    });
}

/** Renders the banner with real timers and waits for it to appear after the 1000ms delay. */
async function renderAndShowBanner() {
    render(<CookieConsentBanner />);
    await screen.findByText('We value your privacy', {}, { timeout: 2000 });
}

describe('CookieConsentBanner', () => {
    beforeEach(() => {
        pageProps = { appSettings: { cookie_consent_enabled: true }, auth: { user: null } };
        routerPost.mockClear();
        vi.mocked(localStorage.getItem).mockReset();
        vi.mocked(localStorage.getItem).mockReturnValue(null);
        vi.mocked(localStorage.setItem).mockReset();
        vi.mocked(localStorage.removeItem).mockReset();
        vi.mocked(localStorage.clear).mockReset();
    });

    it('does not show the banner when cookie consent is disabled', () => {
        pageProps.appSettings = { cookie_consent_enabled: false };

        vi.useFakeTimers();
        render(<CookieConsentBanner />);
        advancePastShowDelay();

        expect(screen.queryByText('We value your privacy')).not.toBeInTheDocument();
        vi.useRealTimers();
    });

    it('does not show the banner when a valid stored consent exists', () => {
        vi.mocked(localStorage.getItem).mockReturnValue(
            JSON.stringify({
                version: '1.0',
                preferences: { essential: true, analytics: true, marketing: false, functional: false },
                timestamp: '2026-01-01T00:00:00.000Z',
            })
        );

        vi.useFakeTimers();
        render(<CookieConsentBanner />);
        advancePastShowDelay();

        expect(screen.queryByText('We value your privacy')).not.toBeInTheDocument();
        vi.useRealTimers();
    });

    it('shows the banner when the stored consent has a stale version', async () => {
        vi.mocked(localStorage.getItem).mockReturnValue(
            JSON.stringify({
                version: '0.9',
                preferences: { essential: true, analytics: true, marketing: false, functional: false },
                timestamp: '2026-01-01T00:00:00.000Z',
            })
        );

        await renderAndShowBanner();

        expect(screen.getByText('We value your privacy')).toBeInTheDocument();
    });

    it('shows the banner when the stored consent is corrupt JSON', async () => {
        vi.mocked(localStorage.getItem).mockReturnValue('{not json');

        await renderAndShowBanner();

        expect(screen.getByText('We value your privacy')).toBeInTheDocument();
    });

    it('shows the banner after the delay with all three actions', async () => {
        await renderAndShowBanner();

        expect(screen.getByText('We value your privacy')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Manage' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Essential Only' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Accept All' })).toBeInTheDocument();
    });

    it('accepts all cookies as a guest, persists to localStorage, and hides the banner without a server call', async () => {
        const user = userEvent.setup();
        await renderAndShowBanner();

        await user.click(screen.getByRole('button', { name: 'Accept All' }));

        expect(localStorage.setItem).toHaveBeenCalledTimes(1);
        const [key, value] = vi.mocked(localStorage.setItem).mock.calls[0];
        expect(key).toBe('cookie_consent');

        const stored = JSON.parse(value as string);
        expect(stored.version).toBe('1.0');
        expect(stored.preferences).toEqual({
            essential: true,
            analytics: true,
            marketing: true,
            functional: true,
        });
        expect(Number.isNaN(new Date(stored.timestamp).getTime())).toBe(false);

        expect(routerPost).not.toHaveBeenCalled();
        expect(screen.queryByText('We value your privacy')).not.toBeInTheDocument();
    });

    it('accepts only essential cookies, persists that preference, and hides the banner', async () => {
        const user = userEvent.setup();
        await renderAndShowBanner();

        await user.click(screen.getByRole('button', { name: 'Essential Only' }));

        const [, value] = vi.mocked(localStorage.setItem).mock.calls[0];
        const stored = JSON.parse(value as string);
        expect(stored.preferences).toEqual({
            essential: true,
            analytics: false,
            marketing: false,
            functional: false,
        });

        expect(screen.queryByText('We value your privacy')).not.toBeInTheDocument();
    });

    it('posts preferences to the server when accepting all as a logged-in user', async () => {
        pageProps.auth = { user: { id: 1 } };
        const user = userEvent.setup();
        await renderAndShowBanner();

        await user.click(screen.getByRole('button', { name: 'Accept All' }));

        expect(routerPost).toHaveBeenCalledTimes(1);
        expect(routerPost).toHaveBeenCalledWith(
            '/cookie-consent.store',
            { analytics: true, marketing: true, functional: true },
            expect.objectContaining({ preserveScroll: true, preserveState: true })
        );
    });

    it('lets the user toggle a preference in the Manage panel and save it', async () => {
        const user = userEvent.setup();
        await renderAndShowBanner();

        await user.click(screen.getByRole('button', { name: 'Manage' }));

        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument();
        const switches = screen.getAllByRole('switch');
        expect(switches).toHaveLength(4);
        expect(switches[0]).toBeChecked();
        expect(switches[0]).toBeDisabled();

        // Toggle the analytics switch on.
        await user.click(switches[1]);

        await user.click(screen.getByRole('button', { name: 'Save Preferences' }));

        const [, value] = vi.mocked(localStorage.setItem).mock.calls[0];
        const stored = JSON.parse(value as string);
        expect(stored.preferences).toEqual({
            essential: true,
            analytics: true,
            marketing: false,
            functional: false,
        });

        expect(screen.queryByText('We value your privacy')).not.toBeInTheDocument();
        expect(screen.queryByText('Cookie Preferences')).not.toBeInTheDocument();
    });

    it('returns to the banner view when the close button in the preferences panel is clicked', async () => {
        const user = userEvent.setup();
        await renderAndShowBanner();

        await user.click(screen.getByRole('button', { name: 'Manage' }));
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument();

        const title = screen.getByText('Cookie Preferences');
        const headerRow = title.parentElement as HTMLElement;
        const closeButton = within(headerRow).getByRole('button');
        await user.click(closeButton);

        expect(screen.getByText('We value your privacy')).toBeInTheDocument();
        expect(screen.queryByText('Cookie Preferences')).not.toBeInTheDocument();
    });

    describe('--cookie-banner-h CSS variable', () => {
        let originalOffsetHeight: PropertyDescriptor | undefined;

        beforeEach(() => {
            originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 96 });
        });

        afterEach(() => {
            if (originalOffsetHeight) {
                Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
            }
            document.documentElement.style.removeProperty('--cookie-banner-h');
        });

        it('sets --cookie-banner-h to the measured banner height while visible', async () => {
            await renderAndShowBanner();

            expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('96px');
        });

        it('resets --cookie-banner-h to 0px after the banner is dismissed', async () => {
            const user = userEvent.setup();
            await renderAndShowBanner();
            expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('96px');

            await user.click(screen.getByRole('button', { name: 'Accept All' }));

            expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('0px');
        });

        it('resets --cookie-banner-h to 0px on unmount', async () => {
            const { unmount } = render(<CookieConsentBanner />);
            await screen.findByText('We value your privacy', {}, { timeout: 2000 });
            expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('96px');

            unmount();

            expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('0px');
        });

        it('re-measures via ResizeObserver when the banner height changes (resize/reflow)', async () => {
            // jsdom has no ResizeObserver — install a fake that captures the
            // callback so the test can simulate a reflow.
            let resizeCallback: (() => void) | null = null;
            const disconnect = vi.fn();
            class FakeResizeObserver {
                constructor(cb: () => void) { resizeCallback = cb; }
                observe() {}
                disconnect() { disconnect(); }
            }
            vi.stubGlobal('ResizeObserver', FakeResizeObserver);

            const { unmount } = render(<CookieConsentBanner />);
            await screen.findByText('We value your privacy', {}, { timeout: 2000 });
            expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('96px');
            expect(resizeCallback).not.toBeNull();

            // Simulate text reflow changing the banner height.
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 128 });
            act(() => { resizeCallback!(); });

            expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('128px');

            unmount();
            expect(disconnect).toHaveBeenCalled();
            expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('0px');

            vi.unstubAllGlobals();
        });
    });
});
