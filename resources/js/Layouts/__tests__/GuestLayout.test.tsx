import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@inertiajs/react', () => ({
    Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
        <a {...props}>{children}</a>
    ),
    usePage: () => ({ props: { appSettings: {} } }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/components/Dashboard/GradientBackground', () => ({
    GradientBackground: () => null,
}));

vi.mock('@/components/ThemeToggle', () => ({
    ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock('@/components/LanguageSelector', () => ({
    LanguageSelector: () => <button type="button">Language</button>,
}));

vi.mock('@/components/ui/sonner', () => ({
    Toaster: () => null,
}));

import Guest from '../GuestLayout';

describe('GuestLayout', () => {
    it('gives the centered content wrapper top padding so it clears the absolute toggle row on short viewports', () => {
        render(
            <Guest>
                <p>Card content</p>
            </Guest>,
        );

        const content = screen.getByText('Card content');
        const wrapper = content.closest('.max-w-md');

        expect(wrapper).not.toBeNull();
        expect(wrapper).toHaveClass('pt-16');
        // ...but only on narrow/short viewports — desktop stays truly centered.
        expect(wrapper).toHaveClass('sm:pt-0');
    });
});
