import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { ShareDialog } from '../ShareDialog';

// Radix Dialog needs these pointer APIs, which jsdom doesn't implement (iter-70 idiom).
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccess(...args),
        error: (...args: unknown[]) => toastError(...args),
    },
}));

function jsonResponse(body: unknown): Response {
    return { json: () => Promise.resolve(body) } as Response;
}

describe('ShareDialog', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(
            jsonResponse({ enabled: true, shareUrl: 'https://example.com/r/ABC123', commissionPercent: 20, code: 'ABC123' })
        );
        vi.stubGlobal('fetch', fetchMock);
        toastSuccess.mockClear();
        toastError.mockClear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows a loading spinner while fetching, then the referral link + commission description once resolved', async () => {
        let resolveFetch: (value: Response) => void = () => {};
        fetchMock.mockImplementationOnce(
            () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
        );

        render(<ShareDialog open onOpenChange={vi.fn()} />);

        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('https://example.com/r/ABC123')).not.toBeInTheDocument();

        resolveFetch(
            jsonResponse({ enabled: true, shareUrl: 'https://example.com/r/ABC123', commissionPercent: 20, code: 'ABC123' })
        );

        await waitFor(() =>
            expect(screen.getByDisplayValue('https://example.com/r/ABC123')).toBeInTheDocument()
        );
        expect(
            screen.getByText('Share your referral link and earn 20% commission on referral purchases.')
        ).toBeInTheDocument();
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
    });

    it('shows the disabled message and no share UI when the program is disabled', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ enabled: false }));

        render(<ShareDialog open onOpenChange={vi.fn()} />);

        expect(await screen.findByText('The referral program is currently disabled.')).toBeInTheDocument();
        expect(screen.getByText('The referral program is currently not available.')).toBeInTheDocument();
        expect(screen.queryByText('Your Referral Link')).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('toasts an error and clears loading when the fetch rejects', async () => {
        fetchMock.mockRejectedValue(new Error('network down'));

        render(<ShareDialog open onOpenChange={vi.fn()} />);

        await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to load referral data'));
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
    });

    it('does not fetch while closed, and fetches once opened', async () => {
        const { rerender } = render(<ShareDialog open={false} onOpenChange={vi.fn()} />);
        expect(fetchMock).not.toHaveBeenCalled();

        rerender(<ShareDialog open onOpenChange={vi.fn()} />);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(fetchMock).toHaveBeenCalledWith('/referral.share-data');
    });

    it('copies the link via navigator.clipboard on the secure path and shows the copied indicator', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

        render(<ShareDialog open onOpenChange={vi.fn()} />);
        await waitFor(() => expect(screen.getByDisplayValue('https://example.com/r/ABC123')).toBeInTheDocument());

        const copyButton = () => document.querySelector('svg.lucide-copy')!.closest('button') as HTMLElement;
        expect(copyButton()).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(copyButton());
        });

        expect(writeText).toHaveBeenCalledWith('https://example.com/r/ABC123');
        expect(toastSuccess).toHaveBeenCalledWith('Link copied to clipboard!');
        expect(document.querySelector('svg.lucide-check')).toBeInTheDocument();
    });

    it('falls back to document.execCommand when clipboard/secure context is unavailable', async () => {
        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        const execCommand = vi.fn();
        document.execCommand = execCommand;

        render(<ShareDialog open onOpenChange={vi.fn()} />);
        await waitFor(() => expect(screen.getByDisplayValue('https://example.com/r/ABC123')).toBeInTheDocument());

        await act(async () => {
            fireEvent.click(document.querySelector('svg.lucide-copy')!.closest('button') as HTMLElement);
        });

        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(document.querySelector('textarea')).not.toBeInTheDocument();
        expect(toastSuccess).toHaveBeenCalledWith('Link copied to clipboard!');
    });

    it('toasts an error when the clipboard write fails', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('denied'));
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

        render(<ShareDialog open onOpenChange={vi.fn()} />);
        await waitFor(() => expect(screen.getByDisplayValue('https://example.com/r/ABC123')).toBeInTheDocument());

        await act(async () => {
            fireEvent.click(document.querySelector('svg.lucide-copy')!.closest('button') as HTMLElement);
        });

        expect(toastError).toHaveBeenCalledWith('Failed to copy link');
        expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('falls back to 0% commission in the description when commissionPercent is missing', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ enabled: true, shareUrl: 'https://example.com/r/XYZ' }));

        render(<ShareDialog open onOpenChange={vi.fn()} />);

        expect(
            await screen.findByText('Share your referral link and earn 0% commission on referral purchases.')
        ).toBeInTheDocument();
    });

    it('renders the referral link input as read-only', async () => {
        render(<ShareDialog open onOpenChange={vi.fn()} />);

        const input = await screen.findByDisplayValue('https://example.com/r/ABC123');
        expect(input).toHaveAttribute('readonly');
        expect(screen.getByText('Your Referral Link')).toBeInTheDocument();
    });
});
