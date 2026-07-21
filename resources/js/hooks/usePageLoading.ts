import { useState, useEffect, useCallback } from 'react';
import { router } from '@inertiajs/react';

interface UsePageLoadingReturn {
    /** True during a same-page reload (filter/sort/pagination/manual reload) or a manual refresh. */
    isLoading: boolean;
    /** True only during manual refresh operations driven by startRefresh/endRefresh. */
    isRefreshing: boolean;
    /** Begin a manual refresh: shows the skeleton until endRefresh() is called. */
    startRefresh: () => void;
    /** End a manual refresh started with startRefresh(). */
    endRefresh: () => void;
}

/**
 * Manage skeleton visibility for a page.
 *
 * IMPORTANT: this does NOT cover the initial page load. Inertia delivers page
 * props synchronously with the component, and the `start` event only fires for
 * client-side visits — so on first paint / hard refresh there is no loading
 * window and `isLoading` stays false. For a true first-paint skeleton, defer
 * the data with Inertia `Deferred` props (Inertia::defer + <Deferred>).
 *
 * What it DOES cover:
 * 1. Same-page GET visits — filter/sort/pagination via router.get(samePath) and
 *    router.reload() of the current page. The skeleton shows while the request
 *    is in flight, then real content returns.
 * 2. Manual refresh — call startRefresh() before your own async work and
 *    endRefresh() when it finishes.
 *
 * Visits that navigate AWAY to a different path do NOT trigger the skeleton
 * (this previously caused a "flash on exit" on the page being left), and
 * non-GET visits (form submits) are ignored so mutations don't blank the page.
 *
 * @example
 * ```tsx
 * const { isLoading } = usePageLoading();
 * return isLoading ? <PageSkeleton /> : <ActualContent />;
 * ```
 */
export function usePageLoading(): UsePageLoadingReturn {
    const [isNavigating, setIsNavigating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const stopNavigating = () => setIsNavigating(false);

        const handleStart = (event: {
            detail?: { visit?: { method?: string; url?: { pathname?: string } } };
        }) => {
            const visit = event?.detail?.visit;
            if (!visit) return;
            // Only reloads of the CURRENT page should show its skeleton. Outbound
            // navigations (a different path) would otherwise flash the skeleton on
            // the page being left, and mutations (non-GET) would blank the page on
            // a form submit. So we scope to same-path GET visits — which is exactly
            // filter/sort/pagination (router.get) and router.reload().
            const isGet = String(visit.method ?? 'get').toLowerCase() === 'get';
            const samePage = visit.url?.pathname === window.location.pathname;
            if (isGet && samePage) setIsNavigating(true);
        };

        const removeStart = router.on('start', handleStart);
        const removeFinish = router.on('finish', stopNavigating);
        // Reset on aborted/failed visits that never deliver 'finish',
        // otherwise the skeleton stays stuck on screen.
        const removeError = router.on('error', stopNavigating);
        const removeCancel = router.on('cancel', stopNavigating);

        return () => {
            removeStart();
            removeFinish();
            removeError();
            removeCancel();
        };
    }, []);

    const startRefresh = useCallback(() => {
        setIsRefreshing(true);
    }, []);

    const endRefresh = useCallback(() => {
        setIsRefreshing(false);
    }, []);

    return {
        isLoading: isNavigating || isRefreshing,
        isRefreshing,
        startRefresh,
        endRefresh,
    };
}
