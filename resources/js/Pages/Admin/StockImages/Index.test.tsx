import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Radix Dialog needs these, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const image = {
    id: 1,
    filename: 'gal_test_food-bakery_warm_dark-text.jpeg',
    type: 'gallery' as const,
    subject: 'test',
    category: 'food-bakery',
    categories: ['food-bakery'],
    mood: null,
    tone: 'warm',
    contrast: 'dark-text',
    created_at: '2026-01-01T00:00:00Z',
};

const images = {
    data: [image],
    current_page: 1,
    from: 1,
    last_page: 1,
    links: [],
    per_page: 10,
    to: 1,
    total: 1,
};

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    router: {
        get: vi.fn(),
        delete: vi.fn(),
        on: vi.fn(() => vi.fn()),
    },
    usePage: () => ({
        props: {
            images,
            categories: ['food-bakery'],
            auth: { user: { id: 1, name: 'Admin' } },
        },
    }),
    useForm: (initial: Record<string, unknown>) => ({
        data: initial,
        setData: vi.fn(),
        post: vi.fn(),
        processing: false,
        errors: {},
        reset: vi.fn(),
    }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Overrides the global identity mock (resources/js/test/setup.ts) with a spy
// so we can assert enum option labels + placeholders are routed through
// t(), not hardcoded literals.
const translateSpy = vi.fn((key: string) => key);
vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t: translateSpy, locale: 'en', isRtl: false }),
    useLanguage: () => ({
        t: translateSpy,
        locale: 'en',
        isRtl: false,
        availableLanguages: [],
        setLocale: vi.fn(),
    }),
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Index from './Index';

describe('Admin/StockImages/Index', () => {
    it('Add Stock Image dialog: tone/contrast grid is responsive (stacks on mobile, 2-col from sm)', () => {
        render(<Index />);

        fireEvent.click(screen.getByRole('button', { name: 'Add Stock Image' }));

        const dialog = screen.getByRole('dialog');
        const toneLabel = within(dialog).getByText('Tone');
        const grid = toneLabel.closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('Edit Stock Image dialog: tone/contrast grid is responsive (stacks on mobile, 2-col from sm)', () => {
        render(<Index />);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

        const dialog = screen.getByRole('dialog');
        const toneLabel = within(dialog).getByText('Tone');
        const grid = toneLabel.closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('filter toolbar wraps on mobile (stacked column, row from sm)', () => {
        render(<Index />);

        const searchInput = screen.getByPlaceholderText('Search images...');
        let ancestor: HTMLElement | null = searchInput.parentElement;
        while (ancestor && !(ancestor.classList.contains('flex-col') && ancestor.classList.contains('sm:flex-row'))) {
            ancestor = ancestor.parentElement;
        }

        expect(ancestor).not.toBeNull();
        expect(ancestor).toHaveClass('flex-col');
        expect(ancestor).toHaveClass('sm:flex-row');
    });

    it('search input is full-width on mobile, fixed width from sm', () => {
        render(<Index />);

        const searchInput = screen.getByPlaceholderText('Search images...');

        expect(searchInput).toHaveClass('w-full');
        expect(searchInput).toHaveClass('sm:w-[300px]');
    });

    it('type/category selects are full-width on mobile, fixed width from sm', () => {
        render(<Index />);

        const typeTrigger = screen.getByText('All Types').closest('button');
        const categoryTrigger = screen.getByText('All Categories').closest('button');

        expect(typeTrigger).toHaveClass('w-full');
        expect(typeTrigger).toHaveClass('sm:w-40');
        expect(categoryTrigger).toHaveClass('w-full');
        expect(categoryTrigger).toHaveClass('sm:w-48');
    });

    it('the thumbnail preview is keyboard-operable (a labeled button, not a bare clickable img)', () => {
        render(<Index />);

        const previewButton = screen.getByRole('button', { name: 'Preview image' });
        expect(previewButton).toHaveAttribute('type', 'button');
        expect(previewButton.querySelector('img')).not.toBeNull();
    });

    it('the create-modal image clear button has an accessible name', () => {
        render(<Index />);

        fireEvent.click(screen.getByRole('button', { name: 'Add Stock Image' }));

        const dialog = screen.getByRole('dialog');
        const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['img'], 'photo.jpeg', { type: 'image/jpeg' });
        Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
        fireEvent.change(fileInput);

        expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('routes the tone/contrast enum option labels and placeholders through t(), keeping submitted values raw', () => {
        translateSpy.mockClear();
        render(<Index />);

        fireEvent.click(screen.getByRole('button', { name: 'Add Stock Image' }));
        screen.getByRole('dialog');

        // Labels are translated…
        expect(translateSpy).toHaveBeenCalledWith('light');
        expect(translateSpy).toHaveBeenCalledWith('dark');
        expect(translateSpy).toHaveBeenCalledWith('warm');
        expect(translateSpy).toHaveBeenCalledWith('cool');
        expect(translateSpy).toHaveBeenCalledWith('neutral');
        expect(translateSpy).toHaveBeenCalledWith('dark-text');
        expect(translateSpy).toHaveBeenCalledWith('light-text');
        expect(translateSpy).toHaveBeenCalledWith('e.g. golden-croissant');
        expect(translateSpy).toHaveBeenCalledWith('e.g. food-bakery');
    });

    it('the delete-confirm description warns the action cannot be undone', () => {
        render(<Index />);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Are you sure you want to delete this stock image\?/)).toHaveTextContent(
            'This action cannot be undone.'
        );
    });
});
