import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PromptInput } from './PromptInput';

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t: (s: string) => s, isRtl: false }),
}));

const baseProps = {
    onSubmit: vi.fn(),
    templates: [
        { id: 1, name: 'Web One', description: null, thumbnail: null, is_system: false, output_target: 'website' as const },
        { id: 2, name: 'WP One', description: null, thumbnail: null, is_system: false, output_target: 'wordpress_theme' as const },
    ],
    supabaseConnections: [{ id: 9, label: 'My DB' }],
};

describe('PromptInput toolbar', () => {
    it('always renders a Customize button and no output-type selector when WordPress is off', () => {
        render(<PromptInput {...baseProps} />);
        expect(screen.getByRole('button', { name: 'Customize' })).toBeTruthy();
        // Only one output type -> no output-type dropdown in the bar; the look/
        // connection pickers live in the (closed) Customize popover.
        expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('shows the output-type dropdown in the bar when WordPress is enabled', () => {
        render(<PromptInput {...baseProps} wordpressEnabled />);
        // The output-type Select is the only combobox rendered in the bar
        // (other pickers are inside the unopened Customize popover).
        expect(screen.getAllByRole('combobox')).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Customize' })).toBeTruthy();
    });

    it('pre-fills the textarea from initialPrompt (landing-page carry-over)', () => {
        render(<PromptInput {...baseProps} initialPrompt="carried over from landing" />);
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('carried over from landing');
    });

    it('gives the prompt textarea an accessible name (the placeholder is empty when unfocused)', () => {
        render(<PromptInput {...baseProps} />);
        // Reachable by accessible name -> aria-label is present even though the
        // visible placeholder is blank until focus and the hint is an overlay.
        expect(screen.getByRole('textbox', { name: 'I want to build...' })).toBeTruthy();
    });

    it('shows the Shopify output option only when shopifyEnabled', () => {
        const { rerender } = render(<PromptInput {...baseProps} shopifyEnabled={false} wordpressEnabled={false} />);
        expect(screen.queryByText(/Shopify Theme/i)).toBeNull();

        rerender(<PromptInput {...baseProps} shopifyEnabled={true} wordpressEnabled={false} />);
        expect(screen.getByText(/Shopify Theme/i)).toBeTruthy();
    });
});
