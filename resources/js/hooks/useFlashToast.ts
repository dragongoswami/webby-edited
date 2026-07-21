import { usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Surfaces server flash messages (success + error) as toasts on pages that
 * don't otherwise display them — e.g. the Chat page after project creation
 * (a GitHub repo-creation warning lands as flash.error), or the Login page
 * after an account-deletion cancel link redirects with flash.success/error.
 *
 * Each channel tracks the last shown value independently, so the same message
 * isn't re-toasted on unrelated re-renders, but a message that is cleared and
 * then reappears fires again.
 *
 * NOTE: do NOT mount this globally. Most pages already fire their own
 * client-side toasts in onSuccess/onError handlers while their controllers
 * also flash success/error — a global mount would double-toast across the app.
 * Mount it only on pages that receive a flash they wouldn't otherwise show.
 */
export function useFlashToast(): void {
    const flash = (usePage().props as { flash?: { success?: string | null; error?: string | null } }).flash;
    const success = flash?.success ?? null;
    const error = flash?.error ?? null;
    const lastError = useRef<string | null>(null);
    const lastSuccess = useRef<string | null>(null);

    useEffect(() => {
        if (error && error !== lastError.current) {
            toast.error(error);
            lastError.current = error;
        } else if (!error) {
            lastError.current = null;
        }
    }, [error]);

    useEffect(() => {
        if (success && success !== lastSuccess.current) {
            toast.success(success);
            lastSuccess.current = success;
        } else if (!success) {
            lastSuccess.current = null;
        }
    }, [success]);
}
