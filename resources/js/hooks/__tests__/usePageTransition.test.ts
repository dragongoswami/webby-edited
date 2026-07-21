import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePageTransition } from '../usePageTransition';

vi.mock('@inertiajs/react', () => ({
    router: {
        on: vi.fn(() => vi.fn()),
    },
}));

describe('usePageTransition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isNavigating false initially', () => {
        const { result } = renderHook(() => usePageTransition());
        expect(result.current.isNavigating).toBe(false);
    });

    it('returns destinationUrl null initially', () => {
        const { result } = renderHook(() => usePageTransition());
        expect(result.current.destinationUrl).toBe(null);
    });

    it('registers start and finish listeners', async () => {
        const { router } = await import('@inertiajs/react');
        renderHook(() => usePageTransition());
        expect(router.on).toHaveBeenCalledWith('start', expect.any(Function));
        expect(router.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('registers error and cancel listeners to recover from aborted visits', async () => {
        const { router } = await import('@inertiajs/react');
        renderHook(() => usePageTransition());
        expect(router.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(router.on).toHaveBeenCalledWith('cancel', expect.any(Function));
    });

    it.each(['error', 'cancel'])(
        'resets navigation state when a visit %ss',
        async (event) => {
            const handlers: Record<string, (e?: unknown) => void> = {};
            const { router } = await import('@inertiajs/react');
            vi.mocked(router.on).mockImplementation((name: string, cb: (e?: unknown) => void) => {
                handlers[name] = cb;
                return vi.fn();
            });

            const { result } = renderHook(() => usePageTransition());

            // Simulate a visit that started but never delivered 'finish'.
            act(() => {
                handlers.start({ detail: { visit: { url: { pathname: '/projects' } } } });
            });
            expect(result.current.isNavigating).toBe(true);
            expect(result.current.destinationUrl).toBe('/projects');

            // The aborting event must clear both flags.
            act(() => {
                handlers[event]();
            });
            expect(result.current.isNavigating).toBe(false);
            expect(result.current.destinationUrl).toBe(null);
        },
    );

    it('cleans up all event listeners on unmount', async () => {
        const removeStart = vi.fn();
        const removeFinish = vi.fn();
        const removeError = vi.fn();
        const removeCancel = vi.fn();
        const { router } = await import('@inertiajs/react');
        vi.mocked(router.on)
            .mockReturnValueOnce(removeStart)
            .mockReturnValueOnce(removeFinish)
            .mockReturnValueOnce(removeError)
            .mockReturnValueOnce(removeCancel);

        const { unmount } = renderHook(() => usePageTransition());
        unmount();

        expect(removeStart).toHaveBeenCalled();
        expect(removeFinish).toHaveBeenCalled();
        expect(removeError).toHaveBeenCalled();
        expect(removeCancel).toHaveBeenCalled();
    });
});
