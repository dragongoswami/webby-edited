import { usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';

/**
 * Resolve the platform's configured currency and return helpers that respect it.
 *
 * Sources the currency code from the globally shared `appSettings.default_currency`
 * (set in HandleInertiaRequests) and delegates to the curated currency.ts utils,
 * so admin/billing amounts render with the correct symbol instead of a hardcoded `$`.
 *
 * - `format(amount)` — full localized amount + symbol (e.g. "₽1,250.00").
 * - `symbol` — the bare currency glyph, for compact chart axes/ticks.
 */
export function useCurrency() {
    const { appSettings } = usePage<PageProps>().props;
    const { locale } = useTranslation();
    const currency = appSettings?.default_currency || 'USD';

    return {
        currency,
        symbol: getCurrencySymbol(currency),
        format: (amount: number) => formatCurrency(amount, currency, locale),
    };
}
