import {
    createContext,
    useContext,
    useCallback,
    useEffect,
    useMemo,
    ReactNode,
} from 'react';
import { usePage, router } from '@inertiajs/react';

interface Language {
    code: string;
    country_code: string;
    name: string;
    native_name: string;
    is_rtl: boolean;
}

interface LocaleData {
    current: string;
    isRtl: boolean;
    available: Language[];
}

interface LanguageContextType {
    locale: string;
    isRtl: boolean;
    availableLanguages: Language[];
    setLocale: (locale: string) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
    undefined
);

const STORAGE_KEY = 'app-locale';
const RTL_STORAGE_KEY = 'app-locale-rtl';

/**
 * Resolve a translation key against a translation map, handling both
 * `:placeholder` replacements and pipe-based pluralization.
 *
 * Plural forms live in the translation value as `singular|plural` or
 * `form1|form2|…|other`. When a `count` replacement is provided, the
 * first form is picked iff count === 1, otherwise the last form —
 * a CLDR-lite approach that covers English/European/Indonesian
 * correctly and degrades to the safest fallback (the "other" category)
 * for locales with richer plural systems.
 *
 * Exported so tests can exercise the logic without the global
 * LanguageContext mock interfering.
 */
export function translate(
    translations: Record<string, string> | undefined,
    key: string,
    replacements?: Record<string, string | number>
): string {
    let translation = translations?.[key] ?? key;

    if (translation.includes('|') && replacements && 'count' in replacements) {
        const forms = translation.split('|');
        const count = Number(replacements.count);
        translation = count === 1 ? forms[0] : forms[forms.length - 1];
    }

    if (replacements) {
        // Longest keys first so `:countTotal` is consumed before `:count`, and a
        // trailing-word-char lookahead stops `:count` from matching inside
        // `:countTotal`. Global so a placeholder used more than once is fully
        // substituted (the old single `String.replace` only hit the first).
        const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);
        keys.forEach((k) => {
            const pattern = new RegExp(`:${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'g');
            translation = translation.replace(pattern, String(replacements[k]));
        });
    }

    return translation;
}

interface LanguageProviderProps {
    children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
    const props = usePage().props as {
        locale?: LocaleData;
        translations?: Record<string, string>;
    };

    const locale = props.locale?.current ?? 'en';
    const isRtl = props.locale?.isRtl ?? false;
    const availableLanguages = useMemo(
        () => props.locale?.available ?? [],
        [props.locale?.available]
    );
    const translations = useMemo(
        () => props.translations ?? {},
        [props.translations]
    );

    // Apply RTL and lang to document
    useEffect(() => {
        document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
        document.documentElement.lang = locale;
        localStorage.setItem(STORAGE_KEY, locale);
        localStorage.setItem(RTL_STORAGE_KEY, String(isRtl));
    }, [isRtl, locale]);

    const setLocale = useCallback((newLocale: string) => {
        // Store locale and RTL status in localStorage
        localStorage.setItem(STORAGE_KEY, newLocale);
        const newLanguage = availableLanguages.find(
            (lang) => lang.code === newLocale
        );
        localStorage.setItem(RTL_STORAGE_KEY, String(newLanguage?.is_rtl ?? false));

        router.post(
            '/locale',
            { locale: newLocale },
            {
                preserveState: false,
                preserveScroll: true,
            }
        );
    }, [availableLanguages]);

    const t = useMemo(() => {
        return (key: string, replacements?: Record<string, string | number>) =>
            translate(translations, key, replacements);
    }, [translations]);

    const value = useMemo(
        () => ({
            locale,
            isRtl,
            availableLanguages,
            setLocale,
            t,
        }),
        [locale, isRtl, availableLanguages, setLocale, t]
    );

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage(): LanguageContextType {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

// Convenience hook for translations only
export function useTranslation() {
    const { t, locale, isRtl } = useLanguage();
    return { t, locale, isRtl };
}
