import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Radix Dialog needs these, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('@inertiajs/react', () => ({
    router: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        on: vi.fn(() => vi.fn()),
    },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Index from './Index';

const auth = { user: { id: 1, name: 'Admin', email: 'admin@example.com' } } as never;

const languages = [
    {
        id: 1,
        code: 'en',
        country_code: 'US',
        name: 'English',
        native_name: 'English',
        is_rtl: false,
        is_active: true,
        is_default: true,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    },
];

describe('Admin/Languages/Index', () => {
    it('Add Language dialog: language-code/country-flag grid is responsive (stacks on mobile, 2-col from sm)', () => {
        render(<Index auth={auth} languages={languages} availableLocales={['en', 'fr']} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add Language' }));

        const dialog = screen.getByRole('dialog');
        const codeLabel = within(dialog).getByText('Language Code');
        const grid = codeLabel.closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('locale combobox dropdown panel is bounded to the viewport width', () => {
        render(<Index auth={auth} languages={languages} availableLocales={['en', 'fr']} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add Language' }));
        fireEvent.click(screen.getByText('Select language...'));

        const panel = screen.getByText('fr').closest('div[class*="absolute"]');
        expect(panel).toHaveClass('w-full');
        expect(panel).toHaveClass('max-w-[calc(100vw-3rem)]');
    });

    it('country combobox dropdown panel is bounded to the viewport width', () => {
        render(<Index auth={auth} languages={languages} availableLocales={['en', 'fr']} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add Language' }));
        fireEvent.click(screen.getByText('Select country...'));

        const panel = screen.getByPlaceholderText('Search countries...').closest('div[class*="absolute"]');
        expect(panel).toHaveClass('w-full');
        expect(panel).toHaveClass('max-w-[calc(100vw-3rem)]');
    });
});
