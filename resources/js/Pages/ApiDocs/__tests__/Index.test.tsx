import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
        <a {...props}>{children}</a>
    ),
}));

vi.mock('@/components/Sidebar/AppSidebar', () => ({
    AppSidebar: () => <div data-testid="app-sidebar" />,
}));

vi.mock('@/components/Header/AppPageHeader', () => ({
    AppPageHeader: () => <div data-testid="app-page-header" />,
}));

vi.mock('@/components/ui/sonner', () => ({
    Toaster: () => null,
}));

vi.mock('@/components/ApiDocs/EndpointSection', () => ({
    EndpointSection: () => <div data-testid="endpoint-section" />,
}));

vi.mock('axios', () => ({
    default: { post: vi.fn() },
}));

import Index from '../Index';

describe('ApiDocs/Index', () => {
    it('sidebar nav buttons carry the shared focus-visible classes', () => {
        render(<Index auth={{ user: { id: 1, name: 'Ada', email: 'ada@example.com' } as never }} apiBaseUrl="https://example.test" />);

        const overviewButton = screen.getByText('Overview').closest('button');
        expect(overviewButton).not.toBeNull();
        expect(overviewButton).toHaveClass('rounded-md');
        expect(overviewButton).toHaveClass('focus-visible:border-ring');
        expect(overviewButton).toHaveClass('focus-visible:ring-ring/50');
        expect(overviewButton).toHaveClass('focus-visible:ring-[3px]');
        expect(overviewButton).toHaveClass('outline-none');
    });

    it('the sidebar search input has an accessible label', () => {
        render(<Index auth={{ user: { id: 1, name: 'Ada', email: 'ada@example.com' } as never }} apiBaseUrl="https://example.test" />);

        expect(screen.getByLabelText('Search endpoints')).toBeInTheDocument();
    });
});
