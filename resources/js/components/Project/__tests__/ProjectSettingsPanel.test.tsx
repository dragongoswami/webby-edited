import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ProjectSettingsPanel } from '../ProjectSettingsPanel';

// Radix AlertDialog needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        isAxiosError: vi.fn(),
    },
}));

vi.mock('@inertiajs/react', () => ({
    router: {
        put: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        reload: vi.fn(),
    },
    usePage: () => ({
        props: {
            canUseGithub: false,
            databaseEnabled: false,
            canConnectShopify: false,
            shopifyConnections: [],
        },
    }),
    Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a>,
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const baseProject = {
    id: 'proj-1',
    name: 'My Project',
    subdomain: null,
    published_title: null,
    published_description: null,
    published_visibility: 'public',
    share_image: null,
    custom_instructions: null,
};

const baseProps = {
    project: baseProject,
    baseDomain: 'example.com',
    canUseSubdomains: true,
    canCreateMoreSubdomains: true,
    canUsePrivateVisibility: true,
    subdomainUsage: { used: 0, limit: null, unlimited: true, remaining: 0 },
    suggestedSubdomain: 'my-project',
};

describe('ProjectSettingsPanel share-image overlay reveal (mobile fixes Task 12)', () => {
    it('the Remove overlay is touch-visible per the reveal standard', () => {
        const props = {
            ...baseProps,
            project: { ...baseProject, share_image: 'share-images/proj-1.jpg' },
        };

        const { container } = render(<ProjectSettingsPanel {...props} />);

        // Sanity check the overlay is rendered at all.
        expect(screen.getByText('Remove')).toBeInTheDocument();

        const overlay = container.querySelector('.absolute.inset-0.bg-black\\/50');
        expect(overlay).toBeInTheDocument();
        expect(overlay?.className).toContain('opacity-100');
        expect(overlay?.className).toContain('md:opacity-0');
        expect(overlay?.className).toContain('md:group-hover:opacity-100');
        expect(overlay?.className).toContain('group-focus-within:opacity-100');
    });
});
