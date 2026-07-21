import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from '@/components/LanguageSelector';

// Override the global LanguageContext mock (resources/js/test/setup.ts mocks
// useLanguage with availableLanguages: [] which would make the component
// return null). Local vi.mock in a test file takes precedence for that file.
let locale = 'en';
const setLocale = vi.fn();

const availableLanguages = [
    { code: 'en', country_code: 'GB', name: 'English', native_name: 'English', is_rtl: false },
    { code: 'ar', country_code: 'SA', name: 'Arabic', native_name: 'العربية', is_rtl: true },
    { code: 'ja', country_code: 'JP', name: 'Japanese', native_name: '日本語', is_rtl: false },
];

vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        locale,
        availableLanguages,
        setLocale,
    }),
    useTranslation: () => ({ t: (key: string) => key }),
}));

// The dropdown positioning effect measures the trigger's bounding rect;
// stub it so calculatePosition() doesn't blow up under jsdom (iter-85 lesson).
beforeAll(() => {
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
        bottom: 100,
        left: 0,
        top: 80,
        right: 0,
        width: 0,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => {},
    })) as unknown as typeof Element.prototype.getBoundingClientRect;
});

beforeEach(() => {
    locale = 'en';
    setLocale.mockClear();
});

describe('LanguageSelector', () => {
    it('renders the trigger showing the current language flag', () => {
        const { container } = render(<LanguageSelector />);

        const trigger = screen.getByRole('button', { name: /select language/i });
        expect(trigger).toBeInTheDocument();
        // English (locale='en') has country_code 'GB' -> a flag svg, not the Globe fallback
        expect(container.querySelector('svg.lucide-globe')).not.toBeInTheDocument();
    });

    it('menu is closed initially, opens on trigger click listing all languages', () => {
        render(<LanguageSelector />);

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /select language/i }));

        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getByText('English')).toBeInTheDocument();
        expect(screen.getByText('العربية')).toBeInTheDocument();
        expect(screen.getByText('日本語')).toBeInTheDocument();
    });

    it('clicking the trigger again closes the menu (toggle)', () => {
        render(<LanguageSelector />);
        const trigger = screen.getByRole('button', { name: /select language/i });

        fireEvent.click(trigger);
        expect(screen.getByRole('menu')).toBeInTheDocument();

        fireEvent.click(trigger);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('selecting a different language calls setLocale and closes the menu', () => {
        render(<LanguageSelector />);
        fireEvent.click(screen.getByRole('button', { name: /select language/i }));

        fireEvent.click(screen.getByText('العربية'));

        expect(setLocale).toHaveBeenCalledWith('ar');
        expect(setLocale).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('highlights the current locale option with bg-accent and not the others', () => {
        render(<LanguageSelector />);
        fireEvent.click(screen.getByRole('button', { name: /select language/i }));

        const options = screen.getAllByRole('menuitem');
        const enOption = options.find((el) => el.textContent === 'English');
        const arOption = options.find((el) => el.textContent === 'العربية');
        const jaOption = options.find((el) => el.textContent === '日本語');

        // Check for the standalone `bg-accent` class (not the `hover:bg-accent` /
        // `focus:bg-accent` variants every option carries).
        expect(enOption?.className.split(' ')).toContain('bg-accent');
        expect(arOption?.className.split(' ')).not.toContain('bg-accent');
        expect(jaOption?.className.split(' ')).not.toContain('bg-accent');
    });

    it('renders all availableLanguages as menu options', () => {
        render(<LanguageSelector />);
        fireEvent.click(screen.getByRole('button', { name: /select language/i }));

        expect(screen.getAllByRole('menuitem')).toHaveLength(availableLanguages.length);
    });

    it('closes the menu on outside click', () => {
        render(<LanguageSelector />);
        fireEvent.click(screen.getByRole('button', { name: /select language/i }));
        expect(screen.getByRole('menu')).toBeInTheDocument();

        fireEvent.mouseDown(document.body);

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('falls back to the Globe icon when the current locale is not in availableLanguages', () => {
        locale = 'fr'; // stale locale not present in the fixture
        const { container } = render(<LanguageSelector />);

        expect(container.querySelector('svg.lucide-globe')).toBeInTheDocument();
    });
});
