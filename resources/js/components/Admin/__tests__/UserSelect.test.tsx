import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { UserSelect } from '../UserSelect';

// Radix Popover needs these pointer APIs, which jsdom doesn't implement (iter-70 idiom).
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

function jsonResponse(body: unknown): Promise<Response> {
    return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
    } as Response);
}

describe('UserSelect', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockImplementation(() => jsonResponse({ users: [] }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const lastUrl = () => {
        const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
        return call[0] as string;
    };

    it('renders the trigger with the default placeholder when no value/selectedUser', () => {
        render(<UserSelect value="" onChange={vi.fn()} />);
        expect(screen.getByPlaceholderText('Search for a user...')).toBeInTheDocument();
    });

    it('does not fetch when fewer than 2 characters are typed', async () => {
        render(<UserSelect value="" onChange={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a user...'), {
            target: { value: 'j' },
        });

        // Wait past the 300ms debounce window and confirm no fetch was ever scheduled.
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByText('Type at least 2 characters to search')).toBeInTheDocument();
    });

    it('fetches with the encoded search term after the debounce and renders results', async () => {
        fetchMock.mockImplementation(() =>
            jsonResponse({ users: [{ id: 1, name: 'John Doe', email: 'john@example.com' }] })
        );

        render(<UserSelect value="" onChange={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a user...'), {
            target: { value: 'john doe' },
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(lastUrl()).toBe('/admin.users.search?search=john%20doe');

        await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('shows a loading spinner while the fetch is pending', async () => {
        let resolveFetch: (value: Response) => void = () => {};
        fetchMock.mockImplementationOnce(
            () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
        );

        render(<UserSelect value="" onChange={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a user...'), {
            target: { value: 'jo' },
        });

        await waitFor(() => expect(screen.getByText('Searching...')).toBeInTheDocument());
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();

        resolveFetch({
            ok: true,
            json: () => Promise.resolve({ users: [{ id: 2, name: 'Jo Ann', email: 'jo@example.com' }] }),
        } as Response);

        await waitFor(() => expect(screen.getByText('Jo Ann')).toBeInTheDocument());
        expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    it('catches a fetch rejection, clears loading, and falls back to the empty-results state', async () => {
        fetchMock.mockImplementation(() => Promise.reject(new Error('network down')));

        render(<UserSelect value="" onChange={vi.fn()} />);
        expect(() =>
            fireEvent.change(screen.getByPlaceholderText('Search for a user...'), {
                target: { value: 'jo' },
            })
        ).not.toThrow();

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByText('No users found')).toBeInTheDocument());
        expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    it('shows "No users found" when the server returns an empty users array', async () => {
        fetchMock.mockImplementation(() => jsonResponse({ users: [] }));

        render(<UserSelect value="" onChange={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a user...'), {
            target: { value: 'zz' },
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('No users found')).toBeInTheDocument();
    });

    it('selecting a result calls onChange with the id as a string, closes the popover, and shows the selected name', async () => {
        fetchMock.mockImplementation(() =>
            jsonResponse({ users: [{ id: 42, name: 'Jane Smith', email: 'jane@example.com' }] })
        );
        const onChange = vi.fn();

        render(<UserSelect value="" onChange={onChange} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a user...'), {
            target: { value: 'jane' },
        });

        await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Jane Smith').closest('button') as HTMLElement);

        expect(onChange).toHaveBeenCalledWith('42');
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('jane@example.com')).toBeInTheDocument();
        // Popover/search input is replaced by the selected-user display.
        expect(screen.queryByPlaceholderText('Search for a user...')).not.toBeInTheDocument();
    });

    it('the clear button resets selection and calls onChange with an empty string', async () => {
        fetchMock.mockImplementation(() =>
            jsonResponse({ users: [{ id: 7, name: 'Bob Lee', email: 'bob@example.com' }] })
        );
        const onChange = vi.fn();

        render(<UserSelect value="" onChange={onChange} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a user...'), {
            target: { value: 'bob' },
        });
        await waitFor(() => expect(screen.getByText('Bob Lee')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Bob Lee').closest('button') as HTMLElement);

        onChange.mockClear();
        fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

        expect(onChange).toHaveBeenCalledWith('');
        expect(screen.queryByText('Bob Lee')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search for a user...')).toBeInTheDocument();
    });

    it('coalesces rapid successive keystrokes into a single debounced fetch', async () => {
        fetchMock.mockImplementation(() =>
            jsonResponse({ users: [{ id: 1, name: 'John Doe', email: 'john@example.com' }] })
        );

        render(<UserSelect value="" onChange={vi.fn()} />);
        const input = screen.getByPlaceholderText('Search for a user...');
        fireEvent.change(input, { target: { value: 'j' } });
        fireEvent.change(input, { target: { value: 'jo' } });
        fireEvent.change(input, { target: { value: 'joh' } });
        fireEvent.change(input, { target: { value: 'john' } });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(lastUrl()).toBe('/admin.users.search?search=john');

        // Confirm no further fetches trickle in afterward.
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('disabled: the input is disabled and does not respond to interaction; error: applies error styling', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = render(<UserSelect value="" onChange={onChange} disabled />);

        const input = screen.getByPlaceholderText('Search for a user...');
        expect(input).toBeDisabled();

        await user.type(input, 'john');
        expect(input).toHaveValue('');
        expect(fetchMock).not.toHaveBeenCalled();

        rerender(<UserSelect value="" onChange={onChange} error />);
        expect(screen.getByPlaceholderText('Search for a user...').className).toContain('border-destructive');
    });
});
