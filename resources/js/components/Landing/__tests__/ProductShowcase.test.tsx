import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductShowcase } from '../ProductShowcase';
import { useTheme } from '@/contexts/ThemeContext';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (t returns the key itself) — no re-mock needed here.

// Full useTheme() return shape so mocks stay typed (no `any` casts).
const themeValue = (resolvedTheme: 'light' | 'dark'): ReturnType<typeof useTheme> => ({
    theme: resolvedTheme,
    resolvedTheme,
    setTheme: vi.fn(),
});

vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: vi.fn(() => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() })),
}));

// Radix Tabs needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

describe('ProductShowcase', () => {
    it('renders default title, subtitle and the three default tabs', () => {
        render(<ProductShowcase />);

        expect(screen.getByText('See it in action')).toBeInTheDocument();
        expect(
            screen.getByText(
                'A powerful development environment that lets you chat with AI, edit code, and manage projects all in one place.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Inspect' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Code' })).toBeInTheDocument();
    });

    it('content overrides title and subtitle', () => {
        render(<ProductShowcase content={{ title: 'Watch it work', subtitle: 'Custom sub' }} />);

        expect(screen.getByText('Watch it work')).toBeInTheDocument();
        expect(screen.getByText('Custom sub')).toBeInTheDocument();
        expect(screen.queryByText('See it in action')).not.toBeInTheDocument();
    });

    it('renders custom item tabs instead of defaults', () => {
        render(
            <ProductShowcase
                items={[
                    { value: 'a', label: 'Alpha' },
                    { value: 'b', label: 'Beta' },
                ]}
            />,
        );

        expect(screen.getByRole('tab', { name: 'Alpha' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Beta' })).toBeInTheDocument();
        expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    });

    it('derives a tab label fallback when label missing', () => {
        render(<ProductShowcase items={[{ value: 'x' }] as React.ComponentProps<typeof ProductShowcase>['items']} />);

        expect(screen.getByText('Tab')).toBeInTheDocument();
    });

    it('screenshots mode renders one image per tab with the active one visible', () => {
        render(<ProductShowcase />);

        const images = screen.getAllByRole('img');
        expect(images).toHaveLength(3);

        const previewImg = screen.getByAltText('Preview view');
        const codeImg = screen.getByAltText('Code view');
        expect(previewImg.className).toContain('opacity-100');
        expect(codeImg.className).toContain('opacity-0');
    });

    it('screenshot url uses light path by default', () => {
        render(<ProductShowcase />);

        const previewImg = screen.getByAltText('Preview view') as HTMLImageElement;
        expect(previewImg.getAttribute('src')).toBe('/screenshots/preview-light.png');
    });

    it('screenshot url uses dark path when theme is dark', () => {
        vi.mocked(useTheme).mockReturnValue(themeValue('dark'));

        render(<ProductShowcase />);

        const previewImg = screen.getByAltText('Preview view') as HTMLImageElement;
        expect(previewImg.getAttribute('src')).toBe('/screenshots/preview-dark.png');

        vi.mocked(useTheme).mockReturnValue(themeValue('light'));
    });

    it('custom screenshot overrides the fallback path', () => {
        render(
            <ProductShowcase
                items={[{ value: 'p', label: 'P', screenshot_light: 'https://cdn/x-light.png' }]}
            />,
        );

        const img = screen.getByAltText('P view') as HTMLImageElement;
        expect(img.getAttribute('src')).toBe('https://cdn/x-light.png');
    });

    it('video mode renders a YouTube iframe for a valid url', () => {
        render(
            <ProductShowcase
                settings={{ showcase_type: 'video' }}
                content={{ video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }}
            />,
        );

        const iframe = screen.getByTitle('Product demo video') as HTMLIFrameElement;
        expect(iframe.getAttribute('src')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0');
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('the stock 3-tab set keeps a symmetric 3-column grid at every width (no orphaned tab on mobile)', () => {
        render(<ProductShowcase />);

        const tablist = screen.getByRole('tablist');
        expect(tablist).toHaveClass('grid-cols-3');
        expect(tablist).not.toHaveClass('grid-cols-2');
    });

    it('a 4-tab set collapses to 2 even columns below sm', () => {
        render(
            <ProductShowcase
                items={[
                    { value: 'a', label: 'Alpha' },
                    { value: 'b', label: 'Beta' },
                    { value: 'c', label: 'Gamma' },
                    { value: 'd', label: 'Delta' },
                ]}
            />,
        );

        const tablist = screen.getByRole('tablist');
        expect(tablist).toHaveClass('grid-cols-2');
        expect(tablist).toHaveClass('sm:grid-cols-4');
    });

    it('TabsList stays 2 columns below sm for a 2-tab custom set (no sm override needed)', () => {
        render(
            <ProductShowcase
                items={[
                    { value: 'a', label: 'Alpha' },
                    { value: 'b', label: 'Beta' },
                ]}
            />,
        );

        const tablist = screen.getByRole('tablist');
        expect(tablist).toHaveClass('grid-cols-2');
    });

    it('video mode shows an invalid-url message for a non-youtube url', () => {
        render(
            <ProductShowcase
                settings={{ showcase_type: 'video' }}
                content={{ video_url: 'https://example.com/notavideo' }}
            />,
        );

        expect(screen.getByText('Invalid video URL')).toBeInTheDocument();
        expect(screen.queryByTitle('Product demo video')).not.toBeInTheDocument();
    });
});
