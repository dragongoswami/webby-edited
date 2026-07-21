import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Settings from '../Settings';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode; [key: string]: unknown }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}));

vi.mock('@/components/Project/ProjectSettingsPanel', () => ({
    ProjectSettingsPanel: () => <div data-testid="settings-panel" />,
}));

const baseProps = {
    project: {
        id: 'proj-1',
        name: 'My Project',
        subdomain: null,
        published_title: null,
        published_description: null,
        published_visibility: 'public',
        share_image: null,
        custom_instructions: null,
        api_token: null,
        custom_domain: null,
        custom_domain_verified: false,
        custom_domain_ssl_status: null,
    },
    baseDomain: 'example.com',
    canUseSubdomains: true,
    canCreateMoreSubdomains: true,
    canUsePrivateVisibility: true,
    subdomainUsage: { used: 0, limit: null, unlimited: true, remaining: 0 },
    suggestedSubdomain: 'my-project',
};

describe('Project Settings page', () => {
    it('uses dvh (not h-screen) for the full-height wrapper', () => {
        const { container } = render(<Settings {...baseProps} />);
        const root = container.firstElementChild as HTMLElement;

        expect(root.className).toContain('h-dvh');
        expect(root.className).not.toContain('h-screen');
    });
});
