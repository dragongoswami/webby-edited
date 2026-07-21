import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChartColors } from '../useChartColors';

let cssVars: Record<string, string> = {};

beforeEach(() => {
    cssVars = {};
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
        getPropertyValue: (name: string) => cssVars[name] ?? '',
    } as unknown as CSSStyleDeclaration));
});

afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
});

describe('useChartColors', () => {
    it('test_returns_defaults_when_no_css_vars', async () => {
        const { result } = renderHook(() => useChartColors());

        await waitFor(() => expect(result.current.primary).toBe('#10B981'));

        expect(result.current.primary).toBe('#10B981');
        expect(result.current.border).toBe('#e5e7eb');
        expect(result.current.mutedForeground).toBe('#6b7280');
        expect(result.current.card).toBe('#ffffff');
        expect(result.current.cardForeground).toBe('#111827');
        expect(result.current.tooltipBg).toBe('#ffffff');
        expect(result.current.tooltipFg).toBe('#111827');
    });

    it('test_maps_css_vars_when_present', async () => {
        cssVars = {
            '--primary': '220 90% 56%',
            '--border': '0 0% 90%',
            '--muted-foreground': '0 0% 40%',
            '--card': '0 0% 100%',
            '--card-foreground': '0 0% 7%',
            '--popover': '0 0% 98%',
            '--popover-foreground': '0 0% 10%',
        };

        const { result } = renderHook(() => useChartColors());

        await waitFor(() => expect(result.current.primary).toBe('220 90% 56%'));

        expect(result.current.primary).toBe('220 90% 56%');
        expect(result.current.border).toBe('0 0% 90%');
        expect(result.current.mutedForeground).toBe('0 0% 40%');
        expect(result.current.card).toBe('0 0% 100%');
        expect(result.current.cardForeground).toBe('0 0% 7%');
        // --popover maps to tooltipBg, --popover-foreground maps to tooltipFg
        expect(result.current.tooltipBg).toBe('0 0% 98%');
        expect(result.current.tooltipFg).toBe('0 0% 10%');
    });

    it('test_trims_whitespace_from_values', async () => {
        cssVars = { '--primary': '  10 20% 30%  ' };

        const { result } = renderHook(() => useChartColors());

        await waitFor(() => expect(result.current.primary).toBe('10 20% 30%'));

        expect(result.current.primary).toBe('10 20% 30%');
    });

    it('test_partial_vars_fall_back_individually', async () => {
        cssVars = {
            '--primary': '200 50% 50%',
            '--card': '0 0% 95%',
        };

        const { result } = renderHook(() => useChartColors());

        await waitFor(() => expect(result.current.primary).toBe('200 50% 50%'));

        expect(result.current.primary).toBe('200 50% 50%');
        expect(result.current.card).toBe('0 0% 95%');
        // Unset vars use their individual fallback hexes
        expect(result.current.border).toBe('#e5e7eb');
        expect(result.current.mutedForeground).toBe('#6b7280');
        expect(result.current.cardForeground).toBe('#111827');
        expect(result.current.tooltipBg).toBe('#ffffff');
        expect(result.current.tooltipFg).toBe('#111827');
    });

    it('test_updates_on_mutation_observer_class_change', async () => {
        const { result } = renderHook(() => useChartColors());

        // Wait for mount effect to settle with defaults
        await waitFor(() => expect(result.current.primary).toBe('#10B981'));

        // Mutate cssVars and trigger a class attribute change on <html>
        act(() => {
            cssVars['--primary'] = '99 99% 99%';
            document.documentElement.className = 'dark';
        });

        // MutationObserver fires as a microtask; waitFor polls until state updates
        await waitFor(() => expect(result.current.primary).toBe('99 99% 99%'));
    });

    it('test_disconnects_observer_on_unmount', () => {
        const disc = vi.spyOn(MutationObserver.prototype, 'disconnect');

        const { unmount } = renderHook(() => useChartColors());

        unmount();

        expect(disc).toHaveBeenCalled();
    });
});
