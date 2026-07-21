import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { useFlashToast } from './useFlashToast';

vi.mock('@inertiajs/react', () => ({ usePage: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const setFlash = (flash: Record<string, unknown>) => {
    vi.mocked(usePage).mockReturnValue({ props: { flash } } as ReturnType<typeof usePage>);
};

describe('useFlashToast', () => {
    beforeEach(() => vi.clearAllMocks());

    it('toasts flash.error when present', () => {
        setFlash({ error: 'Repo creation failed' });
        renderHook(() => useFlashToast());
        expect(toast.error).toHaveBeenCalledWith('Repo creation failed');
        expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it('does not toast when flash.error is absent', () => {
        setFlash({ error: null });
        renderHook(() => useFlashToast());
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('does not toast when flash is undefined', () => {
        vi.mocked(usePage).mockReturnValue({ props: {} } as ReturnType<typeof usePage>);
        renderHook(() => useFlashToast());
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('does not re-toast the same error on re-render', () => {
        setFlash({ error: 'Repo creation failed' });
        const { rerender } = renderHook(() => useFlashToast());
        rerender();
        expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it('re-toasts the same error message after it was cleared', () => {
        setFlash({ error: 'Repo creation failed' });
        const { rerender } = renderHook(() => useFlashToast());
        expect(toast.error).toHaveBeenCalledTimes(1);

        setFlash({ error: null });
        rerender();
        expect(toast.error).toHaveBeenCalledTimes(1); // cleared → no new toast

        setFlash({ error: 'Repo creation failed' });
        rerender();
        expect(toast.error).toHaveBeenCalledTimes(2); // reappears → fires again
    });

    it('toasts flash.success when present', () => {
        setFlash({ success: 'Your account deletion has been cancelled.' });
        renderHook(() => useFlashToast());
        expect(toast.success).toHaveBeenCalledWith('Your account deletion has been cancelled.');
        expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it('does not toast success when flash.success is absent', () => {
        setFlash({ success: null });
        renderHook(() => useFlashToast());
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('does not re-toast the same success on re-render', () => {
        setFlash({ success: 'Saved' });
        const { rerender } = renderHook(() => useFlashToast());
        rerender();
        expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it('surfaces success and error independently when both present', () => {
        setFlash({ success: 'Saved', error: 'But one thing failed' });
        renderHook(() => useFlashToast());
        expect(toast.success).toHaveBeenCalledWith('Saved');
        expect(toast.error).toHaveBeenCalledWith('But one thing failed');
    });
});
