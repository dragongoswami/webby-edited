import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupabaseSetupGuide } from '../SupabaseSetupGuide';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (t returns the key itself) — no re-mock needed here.

// Radix Sheet/Dialog + ScrollArea need pointer APIs jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

    if (!window.matchMedia) {
        window.matchMedia = (query: string): MediaQueryList => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        });
    }
});

describe('SupabaseSetupGuide', () => {
    it('renders the trigger button', () => {
        render(<SupabaseSetupGuide />);

        expect(
            screen.getByRole('button', { name: 'How do I get these values?' }),
        ).toBeInTheDocument();
        expect(screen.queryByText('Set up a Supabase database')).not.toBeInTheDocument();
    });

    it('opening the guide shows the four steps', async () => {
        const user = userEvent.setup();
        render(<SupabaseSetupGuide />);

        await user.click(screen.getByRole('button', { name: 'How do I get these values?' }));

        expect(await screen.findByText('Set up a Supabase database')).toBeInTheDocument();
        expect(screen.getByText('Create a Supabase project')).toBeInTheDocument();
        expect(screen.getByText('Copy the Project URL')).toBeInTheDocument();
        expect(screen.getByText('Copy the API keys')).toBeInTheDocument();
        expect(screen.getByText('Copy the connection string')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('clicking a step image opens the lightbox', async () => {
        const user = userEvent.setup();
        render(<SupabaseSetupGuide />);

        await user.click(screen.getByRole('button', { name: 'How do I get these values?' }));
        await screen.findByText('Set up a Supabase database');

        expect(screen.queryByRole('dialog', { name: 'Create a Supabase project' })).not.toBeInTheDocument();

        const zoomButtons = screen.getAllByRole('button', { name: 'View full size' });
        await user.click(zoomButtons[0]);

        expect(
            await screen.findByRole('dialog', { name: 'Create a Supabase project' }),
        ).toBeInTheDocument();
    });

    it('pressing Escape closes the lightbox', async () => {
        const user = userEvent.setup();
        render(<SupabaseSetupGuide />);

        await user.click(screen.getByRole('button', { name: 'How do I get these values?' }));
        await screen.findByText('Set up a Supabase database');

        const zoomButtons = screen.getAllByRole('button', { name: 'View full size' });
        await user.click(zoomButtons[0]);
        await screen.findByRole('dialog', { name: 'Create a Supabase project' });

        fireEvent.keyDown(document, { key: 'Escape' });

        await waitFor(() => {
            expect(
                screen.queryByRole('dialog', { name: 'Create a Supabase project' }),
            ).not.toBeInTheDocument();
        });
    });

    it('clicking the close control closes the lightbox', async () => {
        const user = userEvent.setup();
        render(<SupabaseSetupGuide />);

        await user.click(screen.getByRole('button', { name: 'How do I get these values?' }));
        await screen.findByText('Set up a Supabase database');

        const zoomButtons = screen.getAllByRole('button', { name: 'View full size' });
        await user.click(zoomButtons[0]);
        const lightbox = await screen.findByRole('dialog', { name: 'Create a Supabase project' });

        await user.click(within(lightbox).getByRole('button', { name: 'Close' }));

        await waitFor(() => {
            expect(
                screen.queryByRole('dialog', { name: 'Create a Supabase project' }),
            ).not.toBeInTheDocument();
        });
    });
});
