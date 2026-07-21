import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';

interface PageTransitionState {
    isNavigating: boolean;
    destinationUrl: string | null;
}

export function usePageTransition(): PageTransitionState {
    const [isNavigating, setIsNavigating] = useState(false);
    const [destinationUrl, setDestinationUrl] = useState<string | null>(null);

    useEffect(() => {
        const handleStart = (event: { detail: { visit: { url: URL } } }) => {
            setIsNavigating(true);
            setDestinationUrl(event.detail.visit.url.pathname);
        };

        const handleFinish = () => {
            setIsNavigating(false);
            setDestinationUrl(null);
        };

        const removeStart = router.on('start', handleStart);
        const removeFinish = router.on('finish', handleFinish);
        // Reset on aborted/failed visits that never deliver 'finish',
        // otherwise the page stays stuck behind the transition state.
        const removeError = router.on('error', handleFinish);
        const removeCancel = router.on('cancel', handleFinish);

        return () => {
            removeStart();
            removeFinish();
            removeError();
            removeCancel();
        };
    }, []);

    return { isNavigating, destinationUrl };
}
