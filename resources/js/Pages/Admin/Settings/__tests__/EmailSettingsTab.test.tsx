import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EmailSettingsTab from '../EmailSettingsTab';
import type { EmailSettings } from '../types';

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const useFormMock = {
    data: {
        mail_mailer: 'smtp',
        smtp_host: '',
        smtp_port: '587',
        smtp_username: '',
        smtp_password: '',
        smtp_encryption: 'tls',
        mail_from_address: '',
        mail_from_name: '',
        admin_notification_email: '',
        admin_notification_events: [],
    },
    setData: vi.fn(),
    put: vi.fn(),
    processing: false,
    errors: {},
};

vi.mock('@inertiajs/react', () => ({
    useForm: () => useFormMock,
    router: { post: vi.fn() },
}));

const settings: EmailSettings = {
    mail_mailer: 'smtp',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_has_password: false,
    smtp_encryption: 'tls',
    mail_from_address: '',
    mail_from_name: '',
    admin_notification_email: '',
    admin_notification_events: [],
};

describe('Admin/Settings/EmailSettingsTab', () => {
    it('the SMTP password reveal toggle has an accessible name', () => {
        render(<EmailSettingsTab settings={settings} notificationEvents={[]} />);

        expect(screen.getByRole('button', { name: 'Show secret' })).toBeInTheDocument();
    });
});
