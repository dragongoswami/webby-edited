import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WordPressPreview from '../WordPressPreview';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
}));

vi.mock('@/components/Preview/WordPressPlaygroundPreview', () => ({
    WordPressPlaygroundPreview: () => <div data-testid="wp-playground-preview" />,
}));

describe('WordPress Preview page', () => {
    it('uses dvh + full width (not h-screen/w-screen) for the full-page wrapper', () => {
        const { container } = render(
            <WordPressPreview projectName="My Theme" themeZipUrl="/preview/theme.zip" />
        );
        const root = container.firstElementChild as HTMLElement;

        expect(root.className).toContain('h-dvh');
        expect(root.className).not.toContain('h-screen');
        expect(root.className).toContain('w-full');
        expect(root.className).not.toContain('w-screen');
    });

    it('reserves space for the fixed impersonation banner via the CSS var offset', () => {
        const { container } = render(
            <WordPressPreview projectName="My Theme" themeZipUrl="/preview/theme.zip" />
        );
        const root = container.firstElementChild as HTMLElement;

        expect(root.className).toContain('pt-[var(--impersonation-banner-height,0px)]');
    });
});
