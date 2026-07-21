import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DomainSettingsTab from '../DomainSettingsTab';

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        locale: 'en',
        isRtl: false,
    }),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const useFormMock = {
    data: {
        domain_enable_subdomains: true,
        domain_enable_custom_domains: true,
        domain_base_domain: 'example.com',
        domain_server_ip: '1.2.3.4',
        domain_blocked_subdomains: ['blocked-one'],
    },
    setData: vi.fn(),
    put: vi.fn(),
    processing: false,
    errors: {},
};

vi.mock('@inertiajs/react', () => ({
    useForm: () => useFormMock,
}));

describe('Admin/Settings/DomainSettingsTab', () => {
    it('uses a logical ms-1 margin (not physical ml-1) on the blocked-subdomain chip remove button', () => {
        render(<DomainSettingsTab settings={useFormMock.data} />);

        const chip = screen.getByText('blocked-one');
        const removeButton = chip.nextElementSibling as HTMLElement;

        expect(removeButton.tagName).toBe('BUTTON');
        expect(removeButton.className).toContain('ms-1');
        expect(removeButton.className).not.toContain('ml-1');
    });
});
