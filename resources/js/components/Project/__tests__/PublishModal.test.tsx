import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import PublishModal from '../PublishModal';

// Radix Select needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
    },
}));

vi.mock('../SnapshotRollback', () => ({
    SnapshotRollback: () => <div data-testid="snapshot-rollback" />,
}));

const routerReload = vi.fn();
const routerVisit = vi.fn();

vi.mock('@inertiajs/react', () => ({
    router: {
        reload: (...args: unknown[]) => routerReload(...args),
        visit: (...args: unknown[]) => routerVisit(...args),
    },
}));

import axios from 'axios';

const defaultProject = {
    id: 'p1',
    name: 'My Project',
    subdomain: null as string | null,
    published_title: null,
    published_description: null,
    published_visibility: 'public',
    published_at: null,
};

type Overrides = Record<string, unknown>;

function baseProps(overrides: Overrides = {}) {
    return {
        open: true,
        onOpenChange: vi.fn(),
        project: defaultProject,
        baseDomain: 'webby.test',
        canUseSubdomains: true,
        canCreateMoreSubdomains: true,
        canUsePrivateVisibility: true,
        suggestedSubdomain: 'my-site',
        onPublished: vi.fn(),
        ...overrides,
    };
}

describe('PublishModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        routerReload.mockClear();
        routerVisit.mockClear();
        vi.mocked(axios.post).mockResolvedValue({ data: { available: true } });
    });

    it('renders the upgrade gate when the plan cannot use subdomains', async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(<PublishModal {...baseProps({ canUseSubdomains: false, onOpenChange })} />);

        expect(screen.getByText('Upgrade to Publish')).toBeInTheDocument();
        expect(screen.queryByLabelText('Subdomain')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'View Plans' }));
        expect(routerVisit).toHaveBeenCalledWith('/billing/plans');

        const closeButtons = screen.getAllByRole('button', { name: 'Close' });
        await user.click(closeButtons[0]);
        expect(onOpenChange).toHaveBeenCalledWith(false);

        expect(axios.post).not.toHaveBeenCalled();
    });

    it('renders the create-publish view with the suggested subdomain prefilled', async () => {
        render(<PublishModal {...baseProps()} />);

        expect(screen.getByText('Publish Project')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
        expect(screen.getByLabelText('Subdomain')).toHaveValue('my-site');
        expect(screen.getByText('.webby.test')).toBeInTheDocument();
        expect(screen.queryByTestId('snapshot-rollback')).not.toBeInTheDocument();

        // Let the debounced availability check settle so it doesn't leak into other tests.
        await waitFor(() => expect(axios.post).toHaveBeenCalled(), { timeout: 1500 });
    });

    it('renders the update view for an already-published project with the rollback panel', async () => {
        render(
            <PublishModal
                {...baseProps({ project: { ...defaultProject, subdomain: 'live-site' } })}
            />
        );

        expect(screen.getByText('Update Published Project')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
        expect(screen.getByLabelText('Subdomain')).toHaveValue('live-site');
        expect(screen.getByTestId('snapshot-rollback')).toBeInTheDocument();

        await waitFor(() => expect(axios.post).toHaveBeenCalled(), { timeout: 1500 });
    });

    it('sanitizes typed input to lowercase alphanumeric-hyphen characters', async () => {
        render(<PublishModal {...baseProps()} />);

        const input = screen.getByLabelText('Subdomain');
        fireEvent.change(input, { target: { value: 'My Site!_99' } });

        expect(input).toHaveValue('mysite99');

        await waitFor(() => expect(axios.post).toHaveBeenCalled(), { timeout: 1500 });
    });

    it('shows a success message when the debounced availability check finds the subdomain free', async () => {
        render(<PublishModal {...baseProps()} />);

        const input = screen.getByLabelText('Subdomain');
        fireEvent.change(input, { target: { value: 'valid-name' } });

        await waitFor(
            () => {
                expect(axios.post).toHaveBeenCalledWith('/api/subdomain/check-availability', {
                    subdomain: 'valid-name',
                    project_id: 'p1',
                });
            },
            { timeout: 1500 }
        );

        expect(await screen.findByText('This subdomain is available!')).toBeInTheDocument();
    });

    it('shows the server error and disables submit when the subdomain is unavailable', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: { available: false, errors: ['Taken already'] },
        });

        render(<PublishModal {...baseProps()} />);

        const input = screen.getByLabelText('Subdomain');
        fireEvent.change(input, { target: { value: 'taken-name' } });

        expect(await screen.findByText('Taken already', {}, { timeout: 1500 })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    });

    it('shows an inline validation message for subdomains under 3 characters without checking availability', async () => {
        render(<PublishModal {...baseProps()} />);

        // Clear the initial call triggered by the suggested subdomain before probing this input.
        await waitFor(() => expect(axios.post).toHaveBeenCalled(), { timeout: 1500 });
        vi.mocked(axios.post).mockClear();

        const input = screen.getByLabelText('Subdomain');
        fireEvent.change(input, { target: { value: 'ab' } });

        expect(
            await screen.findByText(/at least 3 characters/, {}, { timeout: 1500 })
        ).toBeInTheDocument();
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('resets to idle without a message when the availability check errors, leaving submit enabled', async () => {
        vi.mocked(axios.post).mockRejectedValue(new Error('network down'));

        render(<PublishModal {...baseProps()} />);

        const input = screen.getByLabelText('Subdomain');
        fireEvent.change(input, { target: { value: 'valid-name' } });

        await waitFor(() => expect(axios.post).toHaveBeenCalled(), { timeout: 1500 });

        expect(screen.queryByText('This subdomain is available!')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Publish' })).not.toBeDisabled();
    });

    it('publishes successfully, closing the modal and notifying the parent with the returned url', async () => {
        const onOpenChange = vi.fn();
        const onPublished = vi.fn();
        vi.mocked(axios.post).mockImplementation((url: string) => {
            if (url === '/api/subdomain/check-availability') {
                return Promise.resolve({ data: { available: true } });
            }
            if (url === '/project/p1/publish') {
                return Promise.resolve({ data: { success: true, url: 'https://x.webby.test' } });
            }
            return Promise.reject(new Error('unexpected url'));
        });

        render(<PublishModal {...baseProps({ onOpenChange, onPublished })} />);

        await waitFor(
            () => expect(screen.getByText('This subdomain is available!')).toBeInTheDocument(),
            { timeout: 1500 }
        );

        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/project/p1/publish', {
                subdomain: 'my-site',
                visibility: 'public',
            });
        });

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onPublished).toHaveBeenCalledWith('https://x.webby.test');
        expect(routerReload).toHaveBeenCalledWith({ only: ['project'] });
    });

    it('shows the server error banner without closing the modal on publish failure', async () => {
        const onOpenChange = vi.fn();
        vi.mocked(axios.post).mockImplementation((url: string) => {
            if (url === '/api/subdomain/check-availability') {
                return Promise.resolve({ data: { available: true } });
            }
            if (url === '/project/p1/publish') {
                return Promise.reject({ response: { data: { error: 'Quota reached' } } });
            }
            return Promise.reject(new Error('unexpected url'));
        });

        render(<PublishModal {...baseProps({ onOpenChange })} />);

        await waitFor(
            () => expect(screen.getByText('This subdomain is available!')).toBeInTheDocument(),
            { timeout: 1500 }
        );

        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

        expect(await screen.findByText('Quota reached')).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('falls back to the generic error message for a non-response publish error', async () => {
        vi.mocked(axios.post).mockImplementation((url: string) => {
            if (url === '/api/subdomain/check-availability') {
                return Promise.resolve({ data: { available: true } });
            }
            if (url === '/project/p1/publish') {
                return Promise.reject(new Error('boom'));
            }
            return Promise.reject(new Error('unexpected url'));
        });

        render(<PublishModal {...baseProps()} />);

        await waitFor(
            () => expect(screen.getByText('This subdomain is available!')).toBeInTheDocument(),
            { timeout: 1500 }
        );

        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

        expect(await screen.findByText('Failed to publish project.')).toBeInTheDocument();
    });

    it('disables submit when the plan has reached its subdomain limit, even when the name is available', async () => {
        render(<PublishModal {...baseProps({ canCreateMoreSubdomains: false })} />);

        await waitFor(
            () => expect(screen.getByText('This subdomain is available!')).toBeInTheDocument(),
            { timeout: 1500 }
        );

        expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    });

    it('shows the locked private-visibility row when the plan disallows private visibility', async () => {
        const user = userEvent.setup();
        render(<PublishModal {...baseProps({ canUsePrivateVisibility: false })} />);

        await waitFor(() => expect(axios.post).toHaveBeenCalled(), { timeout: 1500 });

        await user.click(screen.getByRole('combobox'));

        expect(screen.queryByRole('option', { name: /private/i })).not.toBeInTheDocument();
        expect(await screen.findByText('Private')).toBeInTheDocument();
    });

    it('shows a selectable private-visibility option when the plan allows it', async () => {
        const user = userEvent.setup();
        render(<PublishModal {...baseProps({ canUsePrivateVisibility: true })} />);

        await waitFor(() => expect(axios.post).toHaveBeenCalled(), { timeout: 1500 });

        await user.click(screen.getByRole('combobox'));

        expect(await screen.findByRole('option', { name: /private/i })).toBeInTheDocument();
    });
});
