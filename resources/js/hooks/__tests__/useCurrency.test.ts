import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePage } from '@inertiajs/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { getCurrencySymbol } from '@/lib/currency';
import { useCurrency } from '../useCurrency';

vi.mock('@inertiajs/react', () => ({
    usePage: vi.fn(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: vi.fn(),
}));

describe('useCurrency', () => {
    beforeEach(() => {
        vi.mocked(usePage).mockReturnValue({
            props: { appSettings: { default_currency: 'USD' } },
        } as ReturnType<typeof usePage>);
        vi.mocked(useTranslation).mockReturnValue({
            locale: 'en-US',
            isRtl: false,
            t: (key: string) => key,
        } as ReturnType<typeof useTranslation>);
    });

    it('returns the configured currency code from appSettings.default_currency', () => {
        vi.mocked(usePage).mockReturnValue({
            props: { appSettings: { default_currency: 'EUR' } },
        } as ReturnType<typeof usePage>);

        const { result } = renderHook(() => useCurrency());
        expect(result.current.currency).toBe('EUR');
    });

    it('falls back to USD when appSettings is undefined', () => {
        vi.mocked(usePage).mockReturnValue({
            props: {},
        } as ReturnType<typeof usePage>);

        const { result } = renderHook(() => useCurrency());
        expect(result.current.currency).toBe('USD');
    });

    it('falls back to USD when default_currency is an empty string', () => {
        vi.mocked(usePage).mockReturnValue({
            props: { appSettings: { default_currency: '' } },
        } as ReturnType<typeof usePage>);

        const { result } = renderHook(() => useCurrency());
        expect(result.current.currency).toBe('USD');
    });

    it('symbol equals getCurrencySymbol(currency) for USD, EUR, and an unknown code', () => {
        // USD → '$'
        vi.mocked(usePage).mockReturnValue({
            props: { appSettings: { default_currency: 'USD' } },
        } as ReturnType<typeof usePage>);
        const { result: usdResult } = renderHook(() => useCurrency());
        expect(usdResult.current.symbol).toBe('$');
        expect(usdResult.current.symbol).toBe(getCurrencySymbol('USD'));

        // EUR → '€'
        vi.mocked(usePage).mockReturnValue({
            props: { appSettings: { default_currency: 'EUR' } },
        } as ReturnType<typeof usePage>);
        const { result: eurResult } = renderHook(() => useCurrency());
        expect(eurResult.current.symbol).toBe('€');
        expect(eurResult.current.symbol).toBe(getCurrencySymbol('EUR'));

        // Unknown code ZZZ → falls back to the code itself
        vi.mocked(usePage).mockReturnValue({
            props: { appSettings: { default_currency: 'ZZZ' } },
        } as ReturnType<typeof usePage>);
        const { result: zzzResult } = renderHook(() => useCurrency());
        expect(zzzResult.current.symbol).toBe('ZZZ');
        expect(zzzResult.current.symbol).toBe(getCurrencySymbol('ZZZ'));
    });

    it('format(amount) delegates to real formatCurrency — USD/en-US produces $ and 1,250.00', () => {
        vi.mocked(usePage).mockReturnValue({
            props: { appSettings: { default_currency: 'USD' } },
        } as ReturnType<typeof usePage>);
        vi.mocked(useTranslation).mockReturnValue({
            locale: 'en-US',
            isRtl: false,
            t: (key: string) => key,
        } as ReturnType<typeof useTranslation>);

        const { result } = renderHook(() => useCurrency());
        const formatted = result.current.format(1250);
        expect(formatted).toContain('$');
        expect(formatted).toContain('1,250.00');
    });

    it('format(amount) uses zero-decimal formatting for JPY (no decimal point)', () => {
        vi.mocked(usePage).mockReturnValue({
            props: { appSettings: { default_currency: 'JPY' } },
        } as ReturnType<typeof usePage>);
        vi.mocked(useTranslation).mockReturnValue({
            locale: 'en-US',
            isRtl: false,
            t: (key: string) => key,
        } as ReturnType<typeof useTranslation>);

        const { result } = renderHook(() => useCurrency());
        const formatted = result.current.format(1000);
        expect(formatted).not.toContain('.');
    });

    it('format uses the locale from useTranslation — EUR output contains € and the numeric part', () => {
        vi.mocked(usePage).mockReturnValue({
            props: { appSettings: { default_currency: 'EUR' } },
        } as ReturnType<typeof usePage>);
        vi.mocked(useTranslation).mockReturnValue({
            locale: 'en-US',
            isRtl: false,
            t: (key: string) => key,
        } as ReturnType<typeof useTranslation>);

        const { result } = renderHook(() => useCurrency());
        const formatted = result.current.format(99.99);
        expect(formatted).toContain('€');
        expect(formatted).toContain('99.99');
    });
});
