import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { API_ENDPOINTS } from '@/lib/apiCatalog';
import { EndpointTester } from './EndpointTester';

const me = API_ENDPOINTS.find((e) => e.id === 'me')!;

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
    return vi.fn().mockResolvedValue({
        status,
        headers: new Headers(headers),
        text: () => Promise.resolve(JSON.stringify(body)),
    });
}

describe('EndpointTester', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch(200, { data: { id: 1 } }, { 'X-RateLimit-Remaining': '59' }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('prompts for a key instead of sending when none is set', () => {
        render(<EndpointTester endpoint={me} baseUrl="https://app.test/api/v1" apiKey="" paramValues={{}} onParamChange={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /Send request/ }));
        expect(fetch).not.toHaveBeenCalled();
        expect(screen.getByText('Enter your API key above to send a test request.')).toBeInTheDocument();
    });

    it('does not send when a required path param is empty', () => {
        const detail = API_ENDPOINTS.find((e) => e.id === 'project-detail')!;
        render(<EndpointTester endpoint={detail} baseUrl="https://app.test/api/v1" apiKey="sk_test" paramValues={{}} onParamChange={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /Send request/ }));
        expect(fetch).not.toHaveBeenCalled();
        expect(screen.getByText('Fill in the required parameters before sending.')).toBeInTheDocument();
    });

    it('sends once the required path param is filled', async () => {
        const detail = API_ENDPOINTS.find((e) => e.id === 'project-detail')!;
        render(<EndpointTester endpoint={detail} baseUrl="https://app.test/api/v1" apiKey="sk_test" paramValues={{ id: 'p-1' }} onParamChange={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /Send request/ }));
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith('https://app.test/api/v1/projects/p-1', expect.anything());
        });
    });

    it('sends a bearer-authenticated request and shows the response', async () => {
        render(<EndpointTester endpoint={me} baseUrl="https://app.test/api/v1" apiKey="sk_test" paramValues={{}} onParamChange={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /Send request/ }));

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith('https://app.test/api/v1/me', {
                headers: {
                    Authorization: 'Bearer sk_test',
                    Accept: 'application/json',
                },
            });
        });
        await waitFor(() => {
            expect(screen.getByText('200')).toBeInTheDocument();
        });
    });

    it('shows error statuses from the API', async () => {
        vi.stubGlobal('fetch', mockFetch(401, { message: 'Unauthenticated.' }));
        render(<EndpointTester endpoint={me} baseUrl="https://app.test/api/v1" apiKey="sk_bad" paramValues={{}} onParamChange={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /Send request/ }));

        await waitFor(() => {
            expect(screen.getByText('401')).toBeInTheDocument();
        });
    });

    it('does not carry a previous response across endpoints (remount via key)', async () => {
        const credits = API_ENDPOINTS.find((e) => e.id === 'credits')!;
        const { rerender } = render(
            <EndpointTester key={me.id} endpoint={me} baseUrl="https://app.test/api/v1" apiKey="sk_test" paramValues={{}} onParamChange={() => {}} />,
        );
        fireEvent.click(screen.getByRole('button', { name: /Send request/ }));
        await waitFor(() => expect(screen.getByText('200')).toBeInTheDocument());

        // Switching sections in the page changes the key → fresh instance.
        rerender(
            <EndpointTester key={credits.id} endpoint={credits} baseUrl="https://app.test/api/v1" apiKey="sk_test" paramValues={{}} onParamChange={() => {}} />,
        );

        // The stale response must be gone until the user sends again.
        expect(screen.queryByText('200')).not.toBeInTheDocument();
    });
});
