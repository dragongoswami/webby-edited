import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGoogleReCaptcha, type IGoogleReCaptchaConsumerProps } from 'react-google-recaptcha-v3';
import { usePage } from '@inertiajs/react';
import { ReCaptchaProvider, useReCaptcha } from '../ReCaptchaProvider';

// --- Boundary mocks -------------------------------------------------------
// ReCaptchaProvider only reads appSettings.recaptcha_enabled/recaptcha_site_key
// from usePage, and delegates to react-google-recaptcha-v3's provider/hook.
// Both are mocked so each test can drive the enabled/disabled + ready/not-ready
// branches directly.

vi.mock('react-google-recaptcha-v3', () => ({
    GoogleReCaptchaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useGoogleReCaptcha: vi.fn(),
}));

interface MockPageProps {
    appSettings: {
        recaptcha_enabled: boolean;
        recaptcha_site_key: string;
    };
}

vi.mock('@inertiajs/react', () => ({
    usePage: vi.fn(),
}));

function mockPage(recaptcha_enabled: boolean, recaptcha_site_key: string) {
    const value: { props: MockPageProps } = {
        props: { appSettings: { recaptcha_enabled, recaptcha_site_key } },
    };
    vi.mocked(usePage<MockPageProps>).mockReturnValue(value);
}

function mockExecuteRecaptcha(props: IGoogleReCaptchaConsumerProps) {
    vi.mocked(useGoogleReCaptcha).mockReturnValue(props);
}

function Consumer() {
    const { getToken, isEnabled } = useReCaptcha();
    const [token, setToken] = useState('<none>');

    return (
        <div>
            <span data-testid="enabled">{String(isEnabled)}</span>
            <button onClick={async () => setToken(await getToken('login'))}>get</button>
            <span data-testid="token">{token}</span>
        </div>
    );
}

describe('ReCaptchaProvider / useReCaptcha', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is disabled when recaptcha_enabled is false', async () => {
        mockPage(false, 'key');
        render(
            <ReCaptchaProvider>
                <Consumer />
            </ReCaptchaProvider>
        );

        expect(screen.getByTestId('enabled')).toHaveTextContent('false');

        fireEvent.click(screen.getByRole('button', { name: 'get' }));

        await waitFor(() => {
            expect(screen.getByTestId('token').textContent).toBe('');
        });
    });

    it('is disabled when the site key is missing', async () => {
        mockPage(true, '');
        render(
            <ReCaptchaProvider>
                <Consumer />
            </ReCaptchaProvider>
        );

        expect(screen.getByTestId('enabled')).toHaveTextContent('false');

        fireEvent.click(screen.getByRole('button', { name: 'get' }));

        await waitFor(() => {
            expect(screen.getByTestId('token').textContent).toBe('');
        });
    });

    it('is enabled and resolves a token when both settings are present', async () => {
        mockPage(true, 'my-key');
        const executeRecaptcha = vi.fn((action: string) => Promise.resolve('tok-' + action));
        mockExecuteRecaptcha({ executeRecaptcha });

        render(
            <ReCaptchaProvider>
                <Consumer />
            </ReCaptchaProvider>
        );

        expect(screen.getByTestId('enabled')).toHaveTextContent('true');

        fireEvent.click(screen.getByRole('button', { name: 'get' }));

        await waitFor(() => {
            expect(screen.getByTestId('token')).toHaveTextContent('tok-login');
        });
        expect(executeRecaptcha).toHaveBeenCalledWith('login');
    });

    it('is enabled but returns an empty token and warns when executeRecaptcha is not ready', async () => {
        mockPage(true, 'my-key');
        mockExecuteRecaptcha({ executeRecaptcha: undefined });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(
            <ReCaptchaProvider>
                <Consumer />
            </ReCaptchaProvider>
        );

        expect(screen.getByTestId('enabled')).toHaveTextContent('true');

        fireEvent.click(screen.getByRole('button', { name: 'get' }));

        await waitFor(() => {
            expect(screen.getByTestId('token').textContent).toBe('');
        });
        expect(warn).toHaveBeenCalledWith('reCAPTCHA not ready');
    });
});
