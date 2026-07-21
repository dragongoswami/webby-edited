import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Radix Dialog needs these, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const designSystem = {
    id: 1,
    slug: 'substrate',
    name: 'Substrate',
    description: 'The default design system',
    when_to_use: null,
    version: '1.0.0',
    author: 'Webby',
    is_default: true,
    status: 'active' as const,
    has_preview: true,
    created_at: '2026-01-01T00:00:00Z',
};

const designSystems = {
    data: [designSystem],
    current_page: 1,
    from: 1,
    last_page: 1,
    links: [],
    per_page: 10,
    to: 1,
    total: 1,
};

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    router: {
        get: vi.fn(),
        delete: vi.fn(),
        on: vi.fn(() => vi.fn()),
    },
    usePage: () => ({
        props: {
            designSystems,
            auth: { user: { id: 1, name: 'Admin' } },
        },
    }),
    useForm: (initial: Record<string, unknown>) => ({
        data: initial,
        setData: vi.fn(),
        post: vi.fn(),
        processing: false,
        errors: {},
        reset: vi.fn(),
    }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Index from '../Index';

describe('Admin/DesignSystems/Index', () => {
    it('the thumbnail preview trigger has an accessible name in addition to its title', () => {
        render(<Index />);

        expect(screen.getByRole('button', { name: 'Preview Substrate' })).toBeInTheDocument();
    });

    it('the create-modal zip clear button has an accessible name', () => {
        render(<Index />);

        fireEvent.click(screen.getByRole('button', { name: 'Add Design System' }));

        const dialog = screen.getByRole('dialog');
        const zipInput = dialog.querySelector('input[type="file"][accept=".zip"]') as HTMLInputElement;
        const file = new File(['zip'], 'substrate.zip', { type: 'application/zip' });
        Object.defineProperty(zipInput, 'files', { value: [file], configurable: true });
        fireEvent.change(zipInput);

        expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });
});
