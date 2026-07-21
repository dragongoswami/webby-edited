import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Section, SectionType, Language } from '../types';

// Radix Dialog/AlertDialog/Select need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const routerPost = vi.fn();
const routerPut = vi.fn();

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode; [key: string]: unknown }) => (
        <a href={href} {...rest}>{children}</a>
    ),
    router: {
        post: (...args: unknown[]) => routerPost(...args),
        put: (...args: unknown[]) => routerPut(...args),
    },
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
    Toaster: () => null,
}));

vi.mock('@/components/ThemeToggle', () => ({
    ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('@/components/LanguageSelector', () => ({
    LanguageSelector: () => <div data-testid="language-selector" />,
}));

import Index from '../Index';
import { ImageUploadField } from '../ImageUploadField';

function makeSectionTypes(): Record<string, SectionType> {
    return {
        hero: {
            name: 'Hero',
            icon: 'Sparkles',
            description: 'Hero section',
            has_items: false,
            content_fields: ['title'],
        },
        testimonials: {
            name: 'Testimonials',
            icon: 'MessageSquare',
            description: 'Customer testimonials',
            has_items: true,
            item_type: 'testimonial',
            content_fields: ['title'],
        },
    };
}

function makeSections(): Section[] {
    return [
        {
            id: 1,
            type: 'hero',
            sort_order: 0,
            is_enabled: true,
            settings: {},
            content: { en: { title: 'Welcome' } },
            items: { en: [] },
        },
        {
            id: 2,
            type: 'testimonials',
            sort_order: 1,
            is_enabled: true,
            settings: {},
            content: { en: { title: 'What people say' } },
            items: {
                en: [
                    {
                        key: 'item-1',
                        sort_order: 0,
                        is_enabled: true,
                        data: {
                            quote: 'Great product',
                            author: 'Jane Doe',
                            role: 'CEO',
                            rating: 5,
                            avatar: null,
                            company_url: null,
                        },
                    },
                ],
            },
        },
    ];
}

const languages: Language[] = [
    { code: 'en', name: 'English', native_name: 'English', is_rtl: false, country_code: 'us' },
];

function renderIndex() {
    return render(
        <Index
            sections={makeSections()}
            sectionTypes={makeSectionTypes()}
            languages={languages}
            defaultLanguage="en"
        />
    );
}

// Substring matching on className is unsafe here because the editor pane
// also carries an unrelated `overflow-hidden` utility — check for the exact
// `hidden` display-utility token instead.
function hasClassToken(element: HTMLElement, token: string): boolean {
    return element.className.split(/\s+/).includes(token);
}

async function waitForLoaded() {
    // The page shows a skeleton for ~100ms before rendering real content.
    await waitFor(() => {
        expect(screen.getByTestId('section-list-pane')).toBeInTheDocument();
    });
}

describe('Admin/LandingBuilder/Index mobile stacking', () => {
    beforeEach(() => {
        routerPost.mockClear();
        routerPut.mockClear();
    });

    it('shows the section list full-width and hides the editor pane until a section is selected', async () => {
        renderIndex();
        await waitForLoaded();

        const listPane = screen.getByTestId('section-list-pane');
        const editorPane = screen.getByTestId('editor-pane');

        expect(hasClassToken(listPane, 'flex')).toBe(true);
        expect(hasClassToken(listPane, 'hidden')).toBe(false);
        expect(hasClassToken(editorPane, 'hidden')).toBe(true);
        expect(editorPane.className).toContain('md:flex');
    });

    it('auto-selects the first section on desktop viewports so the editor pane is populated on load', async () => {
        const original = window.matchMedia;
        window.matchMedia = ((query: string) => ({
            matches: query.includes('min-width: 768px'),
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        })) as typeof window.matchMedia;
        try {
            renderIndex();
            await waitForLoaded();

            const editorPane = screen.getByTestId('editor-pane');
            expect(hasClassToken(editorPane, 'flex')).toBe(true);
            expect(hasClassToken(editorPane, 'hidden')).toBe(false);
        } finally {
            window.matchMedia = original;
        }
    });

    it('selecting a section shows the editor pane full-width with a back button, and back returns to the list', async () => {
        renderIndex();
        await waitForLoaded();

        fireEvent.click(screen.getByText('Testimonials'));

        const listPane = screen.getByTestId('section-list-pane');
        const editorPane = screen.getByTestId('editor-pane');

        expect(hasClassToken(listPane, 'hidden')).toBe(true);
        expect(listPane.className).toContain('md:flex');
        expect(hasClassToken(editorPane, 'flex')).toBe(true);
        expect(hasClassToken(editorPane, 'hidden')).toBe(false);

        const backButton = screen.getByRole('button', { name: 'Back to sections' });
        expect(backButton).toBeInTheDocument();

        fireEvent.click(backButton);

        expect(hasClassToken(screen.getByTestId('section-list-pane'), 'flex')).toBe(true);
        expect(hasClassToken(screen.getByTestId('section-list-pane'), 'hidden')).toBe(false);
        expect(hasClassToken(screen.getByTestId('editor-pane'), 'hidden')).toBe(true);
    });

    it('deleting an item opens an AlertDialog confirm instead of deleting immediately', async () => {
        renderIndex();
        await waitForLoaded();

        fireEvent.click(screen.getByText('Testimonials'));

        const itemRow = screen.getByTestId('item-row-item-1');
        fireEvent.click(within(itemRow).getByTestId('remove-item'));

        const dialog = screen.getByRole('alertdialog');
        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText('Are you sure you want to delete this item?')).toBeInTheDocument();

        // Item is not removed until confirmed.
        expect(screen.getByTestId('item-row-item-1')).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(screen.queryByTestId('item-row-item-1')).not.toBeInTheDocument();
        });
    });

    it('does not render a GripVertical drag handle on non-reorderable item rows', async () => {
        renderIndex();
        await waitForLoaded();

        fireEvent.click(screen.getByText('Testimonials'));

        const itemRow = screen.getByTestId('item-row-item-1');
        expect(itemRow.querySelector('.lucide-grip-vertical')).toBeNull();
    });
});

describe('ImageUploadField mobile touch/keyboard affordances', () => {
    it('drop-zone is keyboard-operable (role=button, tabIndex, Enter/Space trigger the file picker)', () => {
        const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

        render(
            <ImageUploadField
                label="Image"
                value={null}
                onChange={vi.fn()}
                type="image"
                t={(k: string) => k}
            />
        );

        const dropzone = screen.getByTestId('image-upload-dropzone');
        expect(dropzone).toHaveAttribute('role', 'button');
        expect(dropzone).toHaveAttribute('tabindex', '0');

        fireEvent.keyDown(dropzone, { key: 'Enter' });
        expect(clickSpy).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(dropzone, { key: ' ' });
        expect(clickSpy).toHaveBeenCalledTimes(2);

        clickSpy.mockRestore();
    });

    it('remove button uses the touch-visible reveal pattern, a 36px hit target, and an aria-label', () => {
        render(
            <ImageUploadField
                label="Image"
                value="https://example.com/a.png"
                onChange={vi.fn()}
                type="image"
                t={(k: string) => k}
            />
        );

        const removeButton = screen.getByRole('button', { name: 'Remove image' });
        expect(removeButton.className).toContain('opacity-100');
        expect(removeButton.className).toContain('md:opacity-0');
        expect(removeButton.className).toContain('md:group-hover:opacity-100');
        expect(removeButton.className).toContain('group-focus-within:opacity-100');
        expect(removeButton.className).toContain('h-9');
        expect(removeButton.className).toContain('w-9');
    });
});
