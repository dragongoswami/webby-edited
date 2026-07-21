import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Radix AlertDialog needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../SoundSettingsCard', () => ({
    default: () => null,
}));

const mockUseFormReturn = {
    data: {
        preferred_provider: 'system',
        preferred_model: '',
        openai_api_key: '',
        anthropic_api_key: '',
        grok_api_key: '',
        deepseek_api_key: '',
        zhipu_api_key: '',
        ollama_api_key: '',
        openrouter_api_key: '',
    },
    setData: vi.fn(),
    put: vi.fn(),
    processing: false,
    errors: {},
};

const routerPostMock = vi.fn();

vi.mock('@inertiajs/react', () => ({
    useForm: () => mockUseFormReturn,
    router: { post: (...args: unknown[]) => routerPostMock(...args) },
}));

import AiSettingsTab from '../AiSettingsTab';

describe('AiSettingsTab API key fields', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removing a configured key opens an AlertDialog confirm (not window.confirm), and confirming posts the removal', () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        render(
            <AiSettingsTab
                settings={{
                    preferred_provider: 'system',
                    preferred_model: null,
                    has_openai_key: true,
                    openai_key_masked: 'sk-****abcd',
                }}
                canUseOwnKey={true}
                isUsingOwnKey={false}
                providerTypes={{ openai: 'OpenAI' }}
                defaultModels={{}}
                soundSettings={{ enabled: false, style: 'minimal', volume: 50 }}
                soundStyles={['minimal']}
            />
        );

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

        // The remove-key button is the icon-only ghost button next to the "Configured" badge.
        const removeButton = screen.getAllByRole('button').find((btn) => btn.className.includes('text-destructive'));
        expect(removeButton).toBeDefined();
        fireEvent.click(removeButton!);

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(routerPostMock).not.toHaveBeenCalled();
        expect(screen.getByText('Are you sure you want to remove your OpenAI API key?')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

        expect(routerPostMock).toHaveBeenCalledTimes(1);
        const [url, data] = routerPostMock.mock.calls[0];
        expect(url).toBe('/profile/ai-settings/remove-key');
        expect(data).toEqual({ provider: 'openai' });
    });

    it('renders each provider API key input masked (type="password") by default', () => {
        render(
            <AiSettingsTab
                settings={null}
                canUseOwnKey={true}
                isUsingOwnKey={false}
                providerTypes={{ openai: 'OpenAI' }}
                defaultModels={{}}
                soundSettings={{ enabled: false, style: 'minimal', volume: 50 }}
                soundStyles={['minimal']}
            />
        );

        const input = screen.getByPlaceholderText('Enter API key');
        expect(input).toHaveAttribute('type', 'password');
    });

    it('reveals the key as plain text via the shared toggle, then hides it again', () => {
        render(
            <AiSettingsTab
                settings={null}
                canUseOwnKey={true}
                isUsingOwnKey={false}
                providerTypes={{ openai: 'OpenAI' }}
                defaultModels={{}}
                soundSettings={{ enabled: false, style: 'minimal', volume: 50 }}
                soundStyles={['minimal']}
            />
        );

        const input = screen.getByPlaceholderText('Enter API key');
        fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
        expect(input).toHaveAttribute('type', 'text');

        fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
        expect(input).toHaveAttribute('type', 'password');
    });

    it('wires the provider select id to its Label htmlFor', () => {
        render(
            <AiSettingsTab
                settings={null}
                canUseOwnKey={true}
                isUsingOwnKey={false}
                providerTypes={{ openai: 'OpenAI' }}
                defaultModels={{}}
                soundSettings={{ enabled: false, style: 'minimal', volume: 50 }}
                soundStyles={['minimal']}
            />
        );

        const label = screen.getByText('Provider');
        expect(label).toHaveAttribute('for', 'preferred_provider');
        expect(document.getElementById('preferred_provider')).not.toBeNull();
    });

    it('wires the model select id to its Label htmlFor once a non-system provider is chosen', () => {
        const originalData = mockUseFormReturn.data;
        mockUseFormReturn.data = { ...originalData, preferred_provider: 'openai' };

        render(
            <AiSettingsTab
                settings={null}
                canUseOwnKey={true}
                isUsingOwnKey={false}
                providerTypes={{ openai: 'OpenAI' }}
                defaultModels={{ openai: ['gpt-4o'] }}
                soundSettings={{ enabled: false, style: 'minimal', volume: 50 }}
                soundStyles={['minimal']}
            />
        );

        const label = screen.getByText('Model');
        expect(label).toHaveAttribute('for', 'preferred_model');
        expect(document.getElementById('preferred_model')).not.toBeNull();

        mockUseFormReturn.data = originalData;
    });

    it('wires each provider API key input id to its Label htmlFor', () => {
        render(
            <AiSettingsTab
                settings={null}
                canUseOwnKey={true}
                isUsingOwnKey={false}
                providerTypes={{ openai: 'OpenAI' }}
                defaultModels={{}}
                soundSettings={{ enabled: false, style: 'minimal', volume: 50 }}
                soundStyles={['minimal']}
            />
        );

        const input = screen.getByPlaceholderText('Enter API key');
        expect(input).toHaveAttribute('id', 'api-key-openai');
        expect(document.querySelector('label[for="api-key-openai"]')).not.toBeNull();
    });
});
