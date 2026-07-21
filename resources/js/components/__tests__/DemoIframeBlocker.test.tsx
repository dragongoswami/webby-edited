import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { DemoIframeBlocker } from '../DemoIframeBlocker';

// Radix Dialog needs these pointer APIs, which jsdom doesn't implement (iter-70 idiom).
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const { pageState } = vi.hoisted(() => ({
    pageState: { props: { isDemo: false } as { isDemo: boolean } },
}));

vi.mock('@inertiajs/react', () => ({
    usePage: () => pageState,
}));

const originalTopDescriptor = Object.getOwnPropertyDescriptor(window, 'top');
const originalReferrerDescriptor = Object.getOwnPropertyDescriptor(document, 'referrer');

function setInIframe() {
    Object.defineProperty(window, 'top', { configurable: true, get: () => ({}) });
}

function setNotInIframe() {
    Object.defineProperty(window, 'top', { configurable: true, get: () => window });
}

function setTopThrows() {
    Object.defineProperty(window, 'top', {
        configurable: true,
        get: () => {
            throw new Error('cross-origin');
        },
    });
}

function setReferrer(value: string) {
    Object.defineProperty(document, 'referrer', { configurable: true, value });
}

beforeEach(() => {
    pageState.props = { isDemo: false };
    window.open = vi.fn();
});

afterEach(() => {
    cleanup();
    if (originalTopDescriptor) {
        Object.defineProperty(window, 'top', originalTopDescriptor);
    }
    if (originalReferrerDescriptor) {
        Object.defineProperty(document, 'referrer', originalReferrerDescriptor);
    }
    vi.restoreAllMocks();
});

describe('DemoIframeBlocker', () => {
    it('renders nothing when not in demo mode', async () => {
        pageState.props = { isDemo: false };
        setInIframe();
        setReferrer('https://codecanyon.net/item/x');

        render(<DemoIframeBlocker />);

        await waitFor(() => {
            expect(screen.queryByText('Open Demo in New Tab')).not.toBeInTheDocument();
        });
    });

    it('renders nothing in demo when not embedded in an iframe', async () => {
        pageState.props = { isDemo: true };
        setNotInIframe();
        setReferrer('https://codecanyon.net/item/x');

        render(<DemoIframeBlocker />);

        await waitFor(() => {
            expect(screen.queryByText('Open Demo in New Tab')).not.toBeInTheDocument();
        });
    });

    it('renders nothing in demo iframe with a non-CodeCanyon referrer', async () => {
        pageState.props = { isDemo: true };
        setInIframe();
        setReferrer('https://example.com');

        render(<DemoIframeBlocker />);

        await waitFor(() => {
            expect(screen.queryByText('Open Demo in New Tab')).not.toBeInTheDocument();
        });
    });

    it('shows the blocker dialog in a CodeCanyon iframe', async () => {
        pageState.props = { isDemo: true };
        setInIframe();
        setReferrer('https://codecanyon.net/item/x');

        render(<DemoIframeBlocker />);

        expect(await screen.findByText('Open Demo in New Tab')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Open Demo/i })).toBeInTheDocument();
    });

    it('shows the blocker as a fallback when the iframe check throws', async () => {
        pageState.props = { isDemo: true };
        setTopThrows();
        setReferrer('https://example.com');

        render(<DemoIframeBlocker />);

        expect(await screen.findByText('Open Demo in New Tab')).toBeInTheDocument();
    });

    it('Open Demo button opens the current URL in a new tab', async () => {
        pageState.props = { isDemo: true };
        setInIframe();
        setReferrer('https://codecanyon.net/item/x');

        render(<DemoIframeBlocker />);

        const button = await screen.findByRole('button', { name: /Open Demo/i });
        fireEvent.click(button);

        expect(window.open).toHaveBeenCalledWith(window.location.href, '_blank');
    });
});
