import { describe, it, expect } from 'vitest';
import {
    formatCurrency,
    getCurrencySymbol,
    isZeroDecimalCurrency,
    getDecimalPlaces,
    toSmallestUnit,
    fromSmallestUnit,
} from '../currency';

describe('formatCurrency', () => {
    it('formats USD amounts correctly', () => {
        expect(formatCurrency(29.99, 'USD', 'en-US')).toBe('$29.99');
    });

    it('formats zero amount in USD', () => {
        expect(formatCurrency(0, 'USD', 'en-US')).toBe('$0.00');
    });

    it('formats EUR amounts correctly', () => {
        const result = formatCurrency(29.99, 'EUR', 'en-US');
        expect(result).toContain('29.99');
        expect(result).toContain('€');
    });

    it('formats GBP amounts correctly', () => {
        const result = formatCurrency(29.99, 'GBP', 'en-US');
        expect(result).toContain('29.99');
        expect(result).toContain('£');
    });

    it('formats zero-decimal currency (JPY) without decimals', () => {
        const result = formatCurrency(1000, 'JPY', 'en-US');
        expect(result).toContain('1,000');
        expect(result).not.toContain('.');
    });

    it('formats NGN amounts correctly', () => {
        const result = formatCurrency(5000, 'NGN', 'en-US');
        expect(result).toContain('5,000.00');
        // Intl may render as "₦" or "NGN" depending on the environment
        expect(result).toMatch(/₦|NGN/);
    });

    it('defaults to USD when no currency provided', () => {
        expect(formatCurrency(10)).toBe('$10.00');
    });

    it('formats zero amount in non-USD currency', () => {
        const result = formatCurrency(0, 'EUR', 'en-US');
        expect(result).toContain('€');
        expect(result).toContain('0.00');
    });

    it('formats zero amount in zero-decimal currency', () => {
        const result = formatCurrency(0, 'JPY', 'en-US');
        expect(result).not.toContain('.');
    });

    it('formats whole numbers with two decimal places for standard currencies', () => {
        expect(formatCurrency(100, 'USD', 'en-US')).toBe('$100.00');
    });

    it('renders the ₽ glyph for RUB instead of the ISO code', () => {
        const result = formatCurrency(99.99, 'RUB', 'en-US');
        expect(result).toContain('₽');
        expect(result).not.toContain('RUB');
        expect(result).toContain('99.99');
    });

    it('keeps dollar-denominated currencies disambiguated (CAD → CA$, not bare $)', () => {
        expect(formatCurrency(99.99, 'CAD', 'en-US')).toBe('CA$99.99');
        expect(formatCurrency(99.99, 'AUD', 'en-US')).toBe('A$99.99');
        expect(formatCurrency(99.99, 'NZD', 'en-US')).toBe('NZ$99.99');
    });

    it('preserves locale-aware number formatting and symbol placement', () => {
        // Russian locale groups with a comma decimal and places the symbol last.
        const result = formatCurrency(99.99, 'RUB', 'ru-RU');
        expect(result).toContain('₽');
        expect(result).toContain('99,99');
    });
});

describe('getCurrencySymbol', () => {
    it('returns $ for USD', () => {
        expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('returns € for EUR', () => {
        expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('returns £ for GBP', () => {
        expect(getCurrencySymbol('GBP')).toBe('£');
    });

    it('returns ¥ for JPY', () => {
        expect(getCurrencySymbol('JPY')).toBe('¥');
    });

    it('returns ₽ for RUB (not the ISO code)', () => {
        expect(getCurrencySymbol('RUB')).toBe('₽');
    });

    it('returns the disambiguated symbol for dollar-denominated currencies', () => {
        expect(getCurrencySymbol('CAD')).toBe('CA$');
        expect(getCurrencySymbol('AUD')).toBe('A$');
        expect(getCurrencySymbol('SGD')).toBe('S$');
    });

    it('falls back to the code itself for unknown currencies', () => {
        expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    });
});

describe('isZeroDecimalCurrency', () => {
    it('returns true for JPY', () => {
        expect(isZeroDecimalCurrency('JPY')).toBe(true);
    });

    it('returns true for KRW', () => {
        expect(isZeroDecimalCurrency('KRW')).toBe(true);
    });

    it('returns false for USD', () => {
        expect(isZeroDecimalCurrency('USD')).toBe(false);
    });

    it('returns false for EUR', () => {
        expect(isZeroDecimalCurrency('EUR')).toBe(false);
    });
});

describe('getDecimalPlaces', () => {
    it('returns 0 for zero-decimal currencies', () => {
        expect(getDecimalPlaces('JPY')).toBe(0);
        expect(getDecimalPlaces('KRW')).toBe(0);
    });

    it('returns 2 for standard currencies', () => {
        expect(getDecimalPlaces('USD')).toBe(2);
        expect(getDecimalPlaces('EUR')).toBe(2);
    });
});

describe('toSmallestUnit', () => {
    it('converts standard currency to cents', () => {
        expect(toSmallestUnit(29.99, 'USD')).toBe(2999);
    });

    it('returns same value for zero-decimal currencies', () => {
        expect(toSmallestUnit(1000, 'JPY')).toBe(1000);
    });
});

describe('fromSmallestUnit', () => {
    it('converts cents back to standard currency', () => {
        expect(fromSmallestUnit(2999, 'USD')).toBe(29.99);
    });

    it('returns same value for zero-decimal currencies', () => {
        expect(fromSmallestUnit(1000, 'JPY')).toBe(1000);
    });
});
