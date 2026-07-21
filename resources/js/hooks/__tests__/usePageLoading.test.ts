import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePageLoading } from '../usePageLoading';

vi.mock('@inertiajs/react', () => ({
    router: {
        on: vi.fn(() => vi.fn()),
    },
}));

// Inertia `start` event shapes. The hook only reacts to same-path GET visits
// (filter/sort/pagination/reload of the current page), so the URL pathname must
// match window.location.pathname to count as a "current page" reload.
const samePageGet = () => ({
    detail: { visit: { method: 'get', url: new URL(window.location.href) } },
});
// Same path but with a query string — the real shape of a pagination/filter
// visit (e.g. ?page=2). The hook compares pathname only, so this must still fire.
const samePageGetWithQuery = () => {
    const url = new URL(window.location.href);
    url.search = '?page=2&q=foo';
    return { detail: { visit: { method: 'get', url } } };
};
const outboundGet = () => ({
    detail: { visit: { method: 'get', url: new URL('https://example.com/somewhere-else') } },
});
const samePagePost = () => ({
    detail: { visit: { method: 'post', url: new URL(window.location.href) } },
});

// Capture the handlers registered with router.on so tests can drive them.
async function captureHandlers() {
    const handlers: Record<string, (event?: unknown) => void> = {};
    const { router } = await import('@inertiajs/react');
    vi.mocked(router.on).mockImplementation((name: string, cb: (event?: unknown) => void) => {
        handlers[name] = cb;
        return vi.fn();
    });
    return handlers;
}

describe('usePageLoading', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isLoading false initially', () => {
        const { result } = renderHook(() => usePageLoading());
        expect(result.current.isLoading).toBe(false);
    });

    it('returns isRefreshing false initially', () => {
        const { result } = renderHook(() => usePageLoading());
        expect(result.current.isRefreshing).toBe(false);
    });

    it('registers start and finish listeners for Inertia navigation', async () => {
        const { router } = await import('@inertiajs/react');
        renderHook(() => usePageLoading());
        expect(router.on).toHaveBeenCalledWith('start', expect.any(Function));
        expect(router.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('registers error and cancel listeners to recover from aborted visits', async () => {
        const { router } = await import('@inertiajs/react');
        renderHook(() => usePageLoading());
        expect(router.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(router.on).toHaveBeenCalledWith('cancel', expect.any(Function));
    });

    it('shows the skeleton during a same-page GET reload and hides it on finish', async () => {
        const handlers = await captureHandlers();
        const { result } = renderHook(() => usePageLoading());

        act(() => handlers.start(samePageGet()));
        expect(result.current.isLoading).toBe(true);

        act(() => handlers.finish());
        expect(result.current.isLoading).toBe(false);
    });

    it('shows the skeleton for a same-path GET visit that only changes the query string (pagination/filter)', async () => {
        const handlers = await captureHandlers();
        const { result } = renderHook(() => usePageLoading());

        act(() => handlers.start(samePageGetWithQuery()));
        expect(result.current.isLoading).toBe(true);
    });

    it('does NOT show the skeleton when navigating away to a different page (no flash on exit)', async () => {
        const handlers = await captureHandlers();
        const { result } = renderHook(() => usePageLoading());

        act(() => handlers.start(outboundGet()));
        expect(result.current.isLoading).toBe(false);
    });

    it('does NOT show the skeleton for a same-page non-GET visit (form submit)', async () => {
        const handlers = await captureHandlers();
        const { result } = renderHook(() => usePageLoading());

        act(() => handlers.start(samePagePost()));
        expect(result.current.isLoading).toBe(false);
    });

    it('ignores a start event with no visit payload', async () => {
        const handlers = await captureHandlers();
        const { result } = renderHook(() => usePageLoading());

        act(() => handlers.start());
        expect(result.current.isLoading).toBe(false);
    });

    it.each(['error', 'cancel'])(
        'resets isLoading to false when a navigation %ss',
        async (event) => {
            const handlers = await captureHandlers();
            const { result } = renderHook(() => usePageLoading());

            // Simulate a same-page visit that started navigating but never finished.
            act(() => handlers.start(samePageGet()));
            expect(result.current.isLoading).toBe(true);

            // The aborting event must clear the stuck skeleton.
            act(() => handlers[event]());
            expect(result.current.isLoading).toBe(false);
        },
    );

    it('sets isRefreshing true when startRefresh is called', () => {
        const { result } = renderHook(() => usePageLoading());

        act(() => {
            result.current.startRefresh();
        });

        expect(result.current.isRefreshing).toBe(true);
        expect(result.current.isLoading).toBe(true);
    });

    it('sets isRefreshing false when endRefresh is called', () => {
        const { result } = renderHook(() => usePageLoading());

        act(() => {
            result.current.startRefresh();
        });
        expect(result.current.isRefreshing).toBe(true);

        act(() => {
            result.current.endRefresh();
        });
        expect(result.current.isRefreshing).toBe(false);
        expect(result.current.isLoading).toBe(false);
    });

    it('isLoading reflects the combined state of navigation and refresh', () => {
        const { result } = renderHook(() => usePageLoading());

        // Initially both are false
        expect(result.current.isLoading).toBe(false);

        // When refreshing, isLoading should be true
        act(() => {
            result.current.startRefresh();
        });
        expect(result.current.isLoading).toBe(true);

        // After ending refresh, isLoading should be false
        act(() => {
            result.current.endRefresh();
        });
        expect(result.current.isLoading).toBe(false);
    });

    it('cleans up event listeners on unmount', async () => {
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

        const { unmount } = renderHook(() => usePageLoading());
        unmount();

        expect(removeStart).toHaveBeenCalled();
        expect(removeFinish).toHaveBeenCalled();
        expect(removeError).toHaveBeenCalled();
        expect(removeCancel).toHaveBeenCalled();
    });
});
