import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import PlanForm from './PlanForm';

// Radix Select needs these, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// Controllable mock form state — matches the shape useForm returns for PlanForm.
const createUseFormMock = (overrides: Record<string, unknown> = {}) => ({
    data: {
        name: '',
        slug: '',
        description: '',
        price: 0,
        billing_period: 'monthly',
        features: [],
        is_active: true,
        is_popular: false,
        ai_provider_id: null,
        fallback_ai_provider_ids: [],
        builder_id: null,
        monthly_build_credits: 0,
        allow_user_ai_api_key: false,
        max_projects: null,
        enable_subdomains: false,
        max_subdomains_per_user: null,
        allow_private_visibility: false,
        enable_custom_domains: false,
        max_custom_domains_per_user: null,
        enable_web_agent: false,
        max_firecrawl_pages_per_month: null,
        enable_file_storage: false,
        max_storage_mb: null,
        max_file_size_mb: 10,
        allowed_file_types: null,
        enable_database: false,
        enable_code_export: false,
        enable_github: false,
        enable_wordpress: false,
        enable_shopify: false,
        enable_api: false,
        enable_white_label: false,
        copyright_text: '',
        enable_support_tickets: false,
        max_open_tickets_per_user: null,
        single_use: false,
        one_time_credits: false,
        ...overrides,
    },
    setData: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    processing: false,
    errors: {} as Record<string, string>,
});

let mockUseFormReturn = createUseFormMock();
// Captures the initializer PlanForm passes to useForm — the backend's
// "rename keeps the slug" contract depends on the edit form pre-filling
// the current slug, which the return-value mock alone can't see.
let capturedUseFormInit: Record<string, unknown> | undefined;

vi.mock('@inertiajs/react', () => ({
    useForm: (init: Record<string, unknown>) => {
        capturedUseFormInit = init;
        return mockUseFormReturn;
    },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const aiProviders = [{ id: 1, name: 'Provider A', type: 'openai', is_default: true }];
const builders = [{ id: 1, name: 'Builder A' }];

describe('Admin/Plans/Partials/PlanForm', () => {
    beforeEach(() => {
        mockUseFormReturn = createUseFormMock();
    });

    it('price/billing-period grid is responsive (stacks on mobile, 2-col from sm)', () => {
        render(<PlanForm aiProviders={aiProviders} builders={builders} onCancel={vi.fn()} />);

        const priceLabel = screen.getByText('Price *');
        const grid = priceLabel.closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('allowed-file-types grid is responsive (stacks on mobile, 2-col from sm)', () => {
        mockUseFormReturn = createUseFormMock({ enable_file_storage: true });

        render(<PlanForm aiProviders={aiProviders} builders={builders} onCancel={vi.fn()} />);

        const imagesLabel = screen.getByText('Images');
        const grid = imagesLabel.closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('gives billing_period, ai_provider_id, and builder_id SelectTriggers matching ids for their labels', () => {
        render(<PlanForm aiProviders={aiProviders} builders={builders} onCancel={vi.fn()} />);

        expect(screen.getByLabelText('Billing Period *')).toBeInTheDocument();
        expect(screen.getByLabelText('Primary AI Provider')).toBeInTheDocument();
        expect(screen.getByLabelText('Primary Builder')).toBeInTheDocument();
    });

    it('renders an optional slug field that reads as auto-generated when left empty', () => {
        render(<PlanForm aiProviders={aiProviders} builders={builders} onCancel={vi.fn()} />);

        const slugInput = screen.getByLabelText('Slug');
        expect(slugInput).toBeInTheDocument();
        expect(slugInput).toHaveAttribute('placeholder', 'Auto-generated from the plan name');
    });

    it('pre-fills the current slug into the form data on edit', () => {
        // The backend keeps a renamed plan's slug only because the edit form
        // resubmits it — a regression to slug: '' here would silently rewrite
        // slugs on every save while every other test stays green.
        capturedUseFormInit = undefined;
        const plan = {
            id: 7,
            name: 'Pro',
            slug: 'pro',
            description: null,
            price: 29,
            billing_period: 'monthly' as const,
            features: [],
            is_active: true,
            is_popular: false,
            ai_provider_id: null,
            fallback_ai_provider_ids: null,
            builder_id: null,
            monthly_build_credits: 0,
            allow_user_ai_api_key: false,
            max_projects: null,
            enable_subdomains: false,
            max_subdomains_per_user: null,
            allow_private_visibility: false,
            enable_custom_domains: false,
            max_custom_domains_per_user: null,
            max_firecrawl_pages_per_month: null,
            enable_file_storage: false,
            max_storage_mb: null,
            max_file_size_mb: 10,
            allowed_file_types: null,
        };

        render(<PlanForm plan={plan} aiProviders={aiProviders} builders={builders} onCancel={vi.fn()} />);

        expect(capturedUseFormInit?.slug).toBe('pro');
    });
});
