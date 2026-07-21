import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { AiProvider, AiProviderType } from '@/types/admin';

// Radix Dialog/AlertDialog/Select need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

const routerPost = vi.fn();
const routerPut = vi.fn();
const routerDelete = vi.fn();

vi.mock('@inertiajs/react', () => ({
    router: {
        post: (...args: unknown[]) => routerPost(...args),
        put: (...args: unknown[]) => routerPut(...args),
        delete: (...args: unknown[]) => routerDelete(...args),
        // useAdminLoading (used internally by AiProviders) subscribes to these.
        on: vi.fn(() => vi.fn()),
    },
}));

const axiosPost = vi.fn();
const axiosIsAxiosError = vi.fn();

vi.mock('axios', () => ({
    default: {
        post: (...args: unknown[]) => axiosPost(...args),
        isAxiosError: (...args: unknown[]) => axiosIsAxiosError(...args),
    },
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// The global `route()` helper is stubbed by the test setup to ignore params
// (`/${name}`), which would hide a bug where the wrong id is passed. Replace
// it here with a spy that embeds the param so we can assert on the real URL.
const routeSpy = vi.fn((name: string, param?: string | number) =>
    param !== undefined ? `/${name}/${param}` : `/${name}`
);
(globalThis as unknown as { route: typeof routeSpy }).route = routeSpy;

import AiProviders from './AiProviders';
import { toast } from 'sonner';

const currentAdmin = {
    id: 1,
    name: 'Current Admin',
    email: 'admin@example.com',
} as never;

const providerTypes: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    zhipu: 'Zhipu (GLM)',
};

const defaultModels: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini'],
    anthropic: ['claude-3-5-sonnet-latest'],
    zhipu: ['glm-4-plus'],
};

function makeProvider(overrides: Partial<AiProvider> = {}): AiProvider {
    return {
        id: 1,
        name: 'OpenAI Provider',
        type: 'openai' as AiProviderType,
        type_label: 'OpenAI',
        status: 'active',
        has_credentials: true,
        available_models: ['gpt-4o'],
        config: {
            default_model: 'gpt-4o',
            max_tokens: 8192,
            summarizer_max_tokens: 500,
            enable_prompt_caching: true,
        },
        plans_count: 0,
        total_requests: 10,
        last_used_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

function renderPage(providers: AiProvider[]) {
    return render(
        <AiProviders
            user={currentAdmin}
            providers={providers}
            providerTypes={providerTypes}
            defaultModels={defaultModels}
        />
    );
}

describe('Admin/AiProviders', () => {
    beforeEach(() => {
        routerPost.mockClear();
        routerPut.mockClear();
        routerDelete.mockClear();
        routeSpy.mockClear();
        axiosPost.mockReset();
        axiosIsAxiosError.mockReset();
        vi.mocked(toast.success).mockClear();
        vi.mocked(toast.error).mockClear();
    });

    it('renders provider rows with name, type, model, and active status', () => {
        renderPage([
            makeProvider({ id: 1, name: 'OpenAI Provider', type_label: 'OpenAI', status: 'active' }),
            makeProvider({
                id: 2,
                name: 'Anthropic Provider',
                type: 'anthropic' as AiProviderType,
                type_label: 'Anthropic',
                status: 'inactive',
                config: { default_model: 'claude-3-5-sonnet-latest', max_tokens: 4096, enable_prompt_caching: false },
            }),
        ]);

        expect(screen.getByText('OpenAI Provider')).toBeInTheDocument();
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
        expect(screen.getByText('gpt-4o')).toBeInTheDocument();
        expect(screen.getByText('active')).toBeInTheDocument();

        expect(screen.getByText('Anthropic Provider')).toBeInTheDocument();
        expect(screen.getByText('claude-3-5-sonnet-latest')).toBeInTheDocument();
        expect(screen.getByText('inactive')).toBeInTheDocument();

        const switches = screen.getAllByRole('switch');
        expect(switches).toHaveLength(2);
        expect(switches[0]).toBeChecked();
        expect(switches[1]).not.toBeChecked();
    });

    it('shows an empty state when there are no providers', () => {
        renderPage([]);

        expect(screen.getByText('No results.')).toBeInTheDocument();
    });

    it('Add dialog: opens, accepts input including provider type, and submits to the store route', async () => {
        const user = userEvent.setup();
        renderPage([makeProvider()]);

        fireEvent.click(screen.getAllByRole('button', { name: 'Add Provider' })[0]);
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Add a new AI provider configuration')).toBeInTheDocument();

        fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'New Provider' } });
        fireEvent.change(within(dialog).getByLabelText(/API Key/), { target: { value: 'sk-test-123' } });

        // Change provider type to Anthropic via the Radix Select.
        const comboboxes = within(dialog).getAllByRole('combobox');
        await user.click(comboboxes[0]);
        await user.click(await screen.findByRole('option', { name: 'Anthropic' }));

        fireEvent.click(within(dialog).getByRole('button', { name: 'Add Provider' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.ai-providers.store');
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.ai-providers.store');
        expect(data).toEqual({
            name: 'New Provider',
            type: 'anthropic',
            api_key: 'sk-test-123',
            // Selecting a provider type auto-fills the default model for that type.
            default_model: 'claude-3-5-sonnet-latest',
            max_tokens: 8192,
            summarizer_max_tokens: 500,
            enable_prompt_caching: true,
        });
    });

    it('Add dialog: selecting a provider type auto-fills the Model select with its default model', async () => {
        const user = userEvent.setup();
        renderPage([makeProvider()]);

        fireEvent.click(screen.getAllByRole('button', { name: 'Add Provider' })[0]);
        const dialog = screen.getByRole('dialog');

        const comboboxes = within(dialog).getAllByRole('combobox');
        await user.click(comboboxes[0]);
        await user.click(await screen.findByRole('option', { name: 'Zhipu (GLM)' }));

        // The Model select (second combobox) reflects the auto-filled default for zhipu.
        expect(within(dialog).getByText('glm-4-plus')).toBeInTheDocument();
    });

    it('Add dialog: model/max-tokens grid is responsive (stacks on mobile, 2-col from sm)', () => {
        renderPage([makeProvider()]);

        fireEvent.click(screen.getAllByRole('button', { name: 'Add Provider' })[0]);
        const dialog = screen.getByRole('dialog');
        const grid = within(dialog).getByText('Model').closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('Add dialog: blocks submit and shows validation messages when required fields are empty', () => {
        renderPage([makeProvider()]);

        fireEvent.click(screen.getAllByRole('button', { name: 'Add Provider' })[0]);
        const dialog = screen.getByRole('dialog');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Add Provider' }));

        expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
        expect(within(dialog).getByText('API key is required')).toBeInTheDocument();
        expect(routerPost).not.toHaveBeenCalled();
    });

    it('Add dialog: toggling Enable Prompt Caching off is reflected in the submitted payload', () => {
        renderPage([makeProvider()]);

        fireEvent.click(screen.getAllByRole('button', { name: 'Add Provider' })[0]);
        const dialog = screen.getByRole('dialog');

        fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Caching Off Provider' } });
        fireEvent.change(within(dialog).getByLabelText(/API Key/), { target: { value: 'sk-abc' } });

        const cachingSwitch = within(dialog).getByRole('switch');
        expect(cachingSwitch).toBeChecked();
        fireEvent.click(cachingSwitch);
        expect(cachingSwitch).not.toBeChecked();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Add Provider' }));

        expect(routerPost).toHaveBeenCalledTimes(1);
        const [, data] = routerPost.mock.calls[0];
        expect(data).toMatchObject({ enable_prompt_caching: false });
    });

    it('Edit dialog: pre-fills the selected provider (no type selector) and submits to the update route', () => {
        renderPage([
            makeProvider({
                id: 5,
                name: 'Edit Me',
                type: 'anthropic' as AiProviderType,
                config: { default_model: 'claude-3-5-sonnet-latest', max_tokens: 4096, summarizer_max_tokens: 250, enable_prompt_caching: true },
            }),
        ]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByLabelText('Name')).toHaveValue('Edit Me');
        // Edit mode omits the provider-type selector (only one combobox: Model).
        expect(within(dialog).getAllByRole('combobox')).toHaveLength(1);

        fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Edited Name' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.ai-providers.update', 5);
        expect(routerPut).toHaveBeenCalledTimes(1);
        const [url, data] = routerPut.mock.calls[0];
        expect(url).toBe('/admin.ai-providers.update/5');
        expect(data).toEqual({
            name: 'Edited Name',
            type: 'anthropic',
            api_key: '',
            default_model: 'claude-3-5-sonnet-latest',
            max_tokens: 4096,
            summarizer_max_tokens: 250,
            enable_prompt_caching: true,
        });
    });

    it('Delete: confirming the AlertDialog deletes the provider via the destroy route', () => {
        renderPage([makeProvider({ id: 7, name: 'Delete Me', plans_count: 0 })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.ai-providers.destroy', 7);
        expect(routerDelete).toHaveBeenCalledTimes(1);
        expect(routerDelete.mock.calls[0][0]).toBe('/admin.ai-providers.destroy/7');
    });

    it('Delete: cancelling the AlertDialog does not call the destroy route', () => {
        renderPage([makeProvider({ id: 7, name: 'Delete Me', plans_count: 0 })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(routerDelete).not.toHaveBeenCalled();
    });

    it('toggling the status switch puts the flipped status to the update route', () => {
        renderPage([makeProvider({ id: 4, name: 'Toggle Me', status: 'active' })]);

        fireEvent.click(screen.getByRole('switch'));

        expect(routeSpy).toHaveBeenCalledWith('admin.ai-providers.update', 4);
        expect(routerPut).toHaveBeenCalledTimes(1);
        const [url, data] = routerPut.mock.calls[0];
        expect(url).toBe('/admin.ai-providers.update/4');
        expect(data).toEqual({ status: 'inactive' });
    });

    it('Test Connection: posts to the test route, shows a loading spinner while pending, and toasts success on resolve', async () => {
        let resolvePost!: (value: unknown) => void;
        axiosPost.mockReturnValue(new Promise((resolve) => { resolvePost = resolve; }));

        renderPage([makeProvider({ id: 3, name: 'Working Provider', has_credentials: true })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Test Connection' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.ai-providers.test', 3);
        expect(axiosPost).toHaveBeenCalledWith('/admin.ai-providers.test/3');

        // Re-open the menu to observe the pending (disabled + spinning) state.
        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        const pendingItem = screen.getByRole('menuitem', { name: /Test Connection/ });
        expect(pendingItem).toBeDisabled();
        expect(pendingItem.querySelector('.animate-spin')).not.toBeNull();

        resolvePost({ data: { message: 'Connection successful!' } });

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('Connection successful!');
        });
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('Test Connection: toasts the server error message when the request fails', async () => {
        const axiosError = {
            isAxiosError: true,
            response: { data: { message: 'Invalid API key' } },
        };
        axiosPost.mockRejectedValue(axiosError);
        axiosIsAxiosError.mockImplementation((err: unknown) => err === axiosError);

        renderPage([makeProvider({ id: 3, name: 'Broken Provider', has_credentials: true })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Test Connection' }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Invalid API key');
        });
        expect(toast.success).not.toHaveBeenCalled();
    });
});
