import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AuthSettingsTab from '../AuthSettingsTab';
import type { AuthSettings } from '../types';

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const useFormMock = {
    data: {
        enable_registration: true,
        require_email_verification: true,
        recaptcha_enabled: true,
        recaptcha_site_key: '',
        recaptcha_secret_key: '',
        google_login_enabled: true,
        google_client_id: '',
        google_client_secret: '',
        facebook_login_enabled: true,
        facebook_client_id: '',
        facebook_client_secret: '',
        github_login_enabled: true,
        github_client_id: '',
        github_client_secret: '',
        session_timeout: 120,
        password_min_length: 8,
    },
    setData: vi.fn(),
    put: vi.fn(),
    processing: false,
    errors: {},
};

vi.mock('@inertiajs/react', () => ({
    useForm: () => useFormMock,
}));

const settings: AuthSettings = {
    enable_registration: true,
    require_email_verification: true,
    recaptcha_enabled: true,
    recaptcha_site_key: '',
    recaptcha_has_secret: false,
    google_login_enabled: true,
    google_client_id: '',
    google_has_secret: false,
    facebook_login_enabled: true,
    facebook_client_id: '',
    facebook_has_secret: false,
    github_login_enabled: true,
    github_client_id: '',
    github_has_secret: false,
    session_timeout: 120,
    password_min_length: 8,
};

describe('Admin/Settings/AuthSettingsTab', () => {
    it('every secret reveal toggle and callback-URL copy button has an accessible name', () => {
        render(<AuthSettingsTab settings={settings} />);

        expect(screen.getAllByRole('button', { name: 'Show secret' })).toHaveLength(4);
        expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
    });
});
