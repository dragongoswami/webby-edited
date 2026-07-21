import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ScrollToTop } from '../ScrollToTop';

describe('ScrollToTop', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
        window.scrollTo = vi.fn();
    });

    afterEach(() => {
        Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
        vi.restoreAllMocks();
    });

    const scrollTo = (value: number) => {
        Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value });
        act(() => {
            window.dispatchEvent(new Event('scroll'));
        });
    };

    it('positions itself above the cookie-consent banner via the --cookie-banner-h CSS var', () => {
        render(<ScrollToTop />);

        const button = screen.getByRole('button', { name: /scroll to top/i });
        expect(button).toHaveClass('bottom-[calc(1.5rem+var(--cookie-banner-h,0px))]');
        expect(button).not.toHaveClass('bottom-6');
    });

    it('is hidden initially (below the scroll threshold)', () => {
        render(<ScrollToTop />);

        const button = screen.getByRole('button', { name: /scroll to top/i });
        expect(button).toHaveClass('opacity-0');
        expect(button).toHaveClass('pointer-events-none');
        expect(button).not.toHaveClass('opacity-100');
    });

    it('becomes visible after scrolling past 300px', () => {
        render(<ScrollToTop />);
        const button = screen.getByRole('button', { name: /scroll to top/i });

        scrollTo(400);

        expect(button).toHaveClass('opacity-100');
        expect(button).toHaveClass('translate-y-0');
        expect(button).not.toHaveClass('pointer-events-none');
    });

    it('hides again when scrolled back near the top', () => {
        render(<ScrollToTop />);
        const button = screen.getByRole('button', { name: /scroll to top/i });

        scrollTo(400);
        expect(button).toHaveClass('opacity-100');

        scrollTo(100);
        expect(button).toHaveClass('opacity-0');
        expect(button).toHaveClass('pointer-events-none');
    });

    it('clicking scrolls smoothly to the top', () => {
        render(<ScrollToTop />);
        const button = screen.getByRole('button', { name: /scroll to top/i });

        scrollTo(400);
        fireEvent.click(button);

        expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('removes the scroll listener on unmount', () => {
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        const { unmount } = render(<ScrollToTop />);

        unmount();

        expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    });
});
