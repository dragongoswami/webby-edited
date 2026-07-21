import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GeneralSettingsTab from '../GeneralSettingsTab';

// Mock LanguageContext
const translateSpy = vi.fn((key: string) => key);
vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({
        t: translateSpy,
        locale: 'en',
        isRtl: false,
    }),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const useFormMock = {
    data: {
        site_name: '',
        site_description: '',
        site_tagline: '',
        default_theme: 'system',
        color_theme: 'neutral',
        default_locale: 'en',
        timezone: 'UTC',
        date_format: 'Y-m-d',
        landing_page_enabled: true,
        default_currency: 'USD',
        sentry_enabled: false,
        purchase_code: '',
        maintenance_message: '',
        maintenance_retry: 60,
    },
    setData: vi.fn(),
    put: vi.fn(),
    processing: false,
    errors: {},
};

const routerDeleteMock = vi.fn();

vi.mock('@inertiajs/react', () => ({
    useForm: () => useFormMock,
    router: {
        delete: (...args: unknown[]) => routerDeleteMock(...args),
        on: vi.fn(() => vi.fn()),
    },
}));

describe('Admin/Settings/GeneralSettingsTab', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(() =>
            Promise.resolve({ json: () => Promise.resolve({ compatible: [], incompatible: [] }) })
        ));
    });

    it('color-theme swatch grid is responsive (2-col on mobile, 4-col from sm)', () => {
        render(<GeneralSettingsTab settings={{}} languages={[]} />);

        const colorThemeLabel = screen.getByText('Color Theme');
        const grid = colorThemeLabel.closest('.space-y-2')?.querySelector('.grid');

        expect(grid).toHaveClass('grid-cols-2');
        expect(grid).toHaveClass('sm:grid-cols-4');
    });

    it('clicking a branding image remove button opens an AlertDialog confirm before deleting, rather than deleting immediately', () => {
        const { container } = render(
            <GeneralSettingsTab
                settings={{ site_logo: 'branding/logo.png', site_logo_dark: 'branding/logo-dark.png', site_favicon: 'branding/favicon.png' }}
                languages={[]}
            />
        );

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

        const removeButtons = Array.from(container.querySelectorAll('button.bg-destructive'));
        expect(removeButtons.length).toBe(3);

        fireEvent.click(removeButtons[0]);

        // Not deleted yet — the dialog must be confirmed first.
        expect(routerDeleteMock).not.toHaveBeenCalled();
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(screen.getByText('Remove branding image?')).toBeInTheDocument();

        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));

        expect(routerDeleteMock).toHaveBeenCalledTimes(1);
        const [, options] = routerDeleteMock.mock.calls[0];
        expect(options.data).toEqual({ type: 'logo' });
    });

    it('the purchase-code reveal toggle and the branding remove buttons all have accessible names', () => {
        render(
            <GeneralSettingsTab
                settings={{ site_logo: 'branding/logo.png', site_logo_dark: 'branding/logo-dark.png', site_favicon: 'branding/favicon.png' }}
                languages={[]}
            />
        );

        expect(screen.getByRole('button', { name: 'Show secret' })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(3);
    });

    it('routes the maintenance message field and auto-refresh interval field through t(), not hardcoded literals', () => {
        translateSpy.mockClear();
        render(<GeneralSettingsTab settings={{}} languages={[]} />);

        expect(screen.getByText('Maintenance page message')).toBeInTheDocument();
        expect(screen.getByText('Auto-refresh interval (seconds)')).toBeInTheDocument();
        expect(translateSpy).toHaveBeenCalledWith('Maintenance page message');
        expect(translateSpy).toHaveBeenCalledWith(
            'Shown to visitors while an update is being applied. Leave blank for the default.'
        );
        expect(translateSpy).toHaveBeenCalledWith('Auto-refresh interval (seconds)');
    });
});
