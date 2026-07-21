import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { API_ENDPOINTS } from '@/lib/apiCatalog';
import { CodeSamples } from './CodeSamples';

// Radix Tabs needs these pointer APIs, which jsdom doesn't implement (iter-70 idiom).
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// Marker mock: echoes props so tests assert the snippet text + the PRISM_LANG
// mapping without CodeBlock's real Prism internals.
vi.mock('./CodeBlock', () => ({
    CodeBlock: ({ code, language }: { code: string; language: string }) => (
        <pre data-testid="codeblock" data-language={language}>
            {code}
        </pre>
    ),
}));

const generateSnippetMock = vi.fn((lang: string) => `SNIPPET:${lang}`);
vi.mock('@/lib/apiSnippets', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/apiSnippets')>();
    return {
        ...actual,
        generateSnippet: (...args: Parameters<typeof actual.generateSnippet>) => generateSnippetMock(...args),
    };
});

const endpoint = API_ENDPOINTS.find((e) => e.id === 'me')!;
const baseUrl = 'https://app.test/api/v1';
const paramValues = {};

function renderSamples(apiKey = '') {
    return render(
        <CodeSamples endpoint={endpoint} baseUrl={baseUrl} apiKey={apiKey} paramValues={paramValues} />,
    );
}

function copyButtonFor(container: HTMLElement) {
    return container.querySelector('svg.lucide-copy')!.closest('button') as HTMLElement;
}

describe('CodeSamples', () => {
    beforeEach(() => {
        generateSnippetMock.mockClear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('renders a tab per SNIPPET_LANGS with the SNIPPET_LABELS text; curl is the default visible tab', () => {
        renderSamples();

        expect(screen.getByRole('tab', { name: 'curl' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'JavaScript' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'PHP' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Python' })).toBeInTheDocument();

        expect(screen.getByRole('tab', { name: 'curl' })).toHaveAttribute('data-state', 'active');
        expect(screen.getByText('SNIPPET:curl')).toBeVisible();
    });

    it('default curl content calls generateSnippet with the right args and maps curl to bash for CodeBlock', () => {
        renderSamples('');

        expect(generateSnippetMock).toHaveBeenCalledWith('curl', endpoint, baseUrl, paramValues, undefined);

        const curlBlock = screen.getAllByTestId('codeblock').find((el) => el.textContent === 'SNIPPET:curl')!;
        expect(curlBlock).toHaveAttribute('data-language', 'bash');
    });

    it('switching to the PHP tab shows the PHP snippet mapped to the php language', () => {
        renderSamples();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'PHP' }), { button: 0 });

        expect(screen.getByText('SNIPPET:php')).toBeVisible();
        expect(screen.getByText('SNIPPET:php')).toHaveAttribute('data-language', 'php');
    });

    it('switching to the Python tab shows the Python snippet mapped to the python language', () => {
        renderSamples();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Python' }), { button: 0 });

        expect(screen.getByText('SNIPPET:python')).toBeVisible();
        expect(screen.getByText('SNIPPET:python')).toHaveAttribute('data-language', 'python');
    });

    it('switching to the JavaScript tab shows the JavaScript snippet mapped to the javascript language', () => {
        renderSamples();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'JavaScript' }), { button: 0 });

        expect(screen.getByText('SNIPPET:javascript')).toBeVisible();
        expect(screen.getByText('SNIPPET:javascript')).toHaveAttribute('data-language', 'javascript');
    });

    it('passes apiKey as undefined to generateSnippet when the api key is empty', () => {
        renderSamples('');

        expect(generateSnippetMock).toHaveBeenCalledWith('curl', endpoint, baseUrl, paramValues, undefined);
    });

    it('passes the trimmed-truthy apiKey to generateSnippet when provided', () => {
        renderSamples('sk_x');

        expect(generateSnippetMock).toHaveBeenCalledWith('curl', endpoint, baseUrl, paramValues, 'sk_x');
    });

    it('copies via navigator.clipboard on the secure path and flips the button to Copied! with the Check icon', () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

        const { container } = renderSamples();

        fireEvent.click(copyButtonFor(container));

        expect(writeText).toHaveBeenCalledWith('SNIPPET:curl');
        return screen.findByText('Copied!').then(() => {
            expect(document.querySelector('svg.lucide-check')).toBeInTheDocument();
        });
    });

    it('resets the Copied! label back to Copy after 2 seconds', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

        const { container } = renderSamples();

        vi.useFakeTimers();
        fireEvent.click(copyButtonFor(container));

        // Flush the microtask from the async copySnippet before advancing timers.
        await vi.waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(screen.getByText('Copy')).toBeInTheDocument();
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    });

    it('falls back to document.execCommand when clipboard/secure context is unavailable', async () => {
        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        const execCommand = vi.fn();
        document.execCommand = execCommand;
        const writeText = vi.fn();

        const { container } = renderSamples();

        fireEvent.click(copyButtonFor(container));

        expect(await screen.findByText('Copied!')).toBeInTheDocument();
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(writeText).not.toHaveBeenCalled();
        expect(document.querySelector('textarea')).not.toBeInTheDocument();
    });

    it('swallows a clipboard write failure without showing Copied! or crashing', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('denied'));
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

        const { container } = renderSamples();

        fireEvent.click(copyButtonFor(container));

        await vi.waitFor(() => expect(writeText).toHaveBeenCalled());

        expect(screen.getByText('Copy')).toBeInTheDocument();
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    });

    it('shows the API-key warning note only when apiKey has non-whitespace content', () => {
        const { rerender } = renderSamples('sk_live_x');
        expect(
            screen.getByText('Code samples include your API key — be careful where you paste them.'),
        ).toBeInTheDocument();

        rerender(<CodeSamples endpoint={endpoint} baseUrl={baseUrl} apiKey="" paramValues={paramValues} />);
        expect(
            screen.queryByText('Code samples include your API key — be careful where you paste them.'),
        ).not.toBeInTheDocument();

        rerender(<CodeSamples endpoint={endpoint} baseUrl={baseUrl} apiKey="   " paramValues={paramValues} />);
        expect(
            screen.queryByText('Code samples include your API key — be careful where you paste them.'),
        ).not.toBeInTheDocument();
    });

    it('targets the active tab\'s own snippet when copying (per-lang, not always curl)', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

        renderSamples();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Python' }), { button: 0 });

        const pythonPanel = screen.getByText('SNIPPET:python').closest('[role="tabpanel"]') as HTMLElement;
        fireEvent.click(copyButtonFor(pythonPanel));

        await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('SNIPPET:python'));
    });
});
