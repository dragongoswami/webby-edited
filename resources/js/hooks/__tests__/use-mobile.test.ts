import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useIsMobile } from '../use-mobile';

// Shared spy references so we can capture the registered handler between tests.
let changeHandler: (() => void) | null = null;
const addEventListener = vi.fn((_event: string, cb: () => void) => {
    changeHandler = cb;
});
const removeEventListener = vi.fn();

// Helper: set window.innerWidth for the current test.
const setWidth = (w: number) => {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: w,
    });
};

beforeEach(() => {
    changeHandler = null;
    addEventListener.mockClear();
    removeEventListener.mockClear();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener,
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useIsMobile', () => {
    it('test_returns_true_below_breakpoint', () => {
        setWidth(500);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(true);
    });

    it('test_returns_false_at_or_above_breakpoint', () => {
        setWidth(768);
        const { result: resultAt } = renderHook(() => useIsMobile());
        expect(resultAt.current).toBe(false);

        setWidth(1200);
        const { result: resultAbove } = renderHook(() => useIsMobile());
        expect(resultAbove.current).toBe(false);
    });

    it('test_returns_false_just_below_is_true_boundary', () => {
        setWidth(767);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(true);
    });

    it('test_updates_when_media_change_fires', () => {
        setWidth(1200);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(false);

        act(() => {
            setWidth(500);
            changeHandler?.();
        });
        expect(result.current).toBe(true);

        act(() => {
            setWidth(1000);
            changeHandler?.();
        });
        expect(result.current).toBe(false);
    });

    it('test_registers_and_cleans_up_listener', () => {
        const { unmount } = renderHook(() => useIsMobile());

        expect(addEventListener).toHaveBeenCalledTimes(1);
        expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

        unmount();

        expect(removeEventListener).toHaveBeenCalledTimes(1);
        expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('test_queries_correct_breakpoint', () => {
        renderHook(() => useIsMobile());
        expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    });

    it('test_always_returns_boolean', () => {
        setWidth(2000);
        const { result } = renderHook(() => useIsMobile());
        expect(typeof result.current).toBe('boolean');
    });
});
