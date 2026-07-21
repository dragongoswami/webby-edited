import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreditPackForm from './CreditPackForm';

// Controllable mock form state — matches the shape useForm returns for CreditPackForm
const createUseFormMock = (overrides: Partial<{ plan_ids: number[] }> = {}) => ({
    data: {
        name: '',
        description: '',
        credits: 0,
        bonus_credits: 0,
        price: '',
        is_active: true,
        is_popular: false,
        sort_order: 0,
        plan_ids: [] as number[],
        ...overrides,
    },
    setData: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    processing: false,
    errors: {} as Record<string, string>,
});

let mockUseFormReturn = createUseFormMock();

vi.mock('@inertiajs/react', () => ({
    useForm: () => mockUseFormReturn,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// LanguageContext is already globally mocked by resources/js/test/setup.ts
// route() is already globally stubbed by resources/js/test/setup.ts

const plans = [
    { id: 2, name: 'Pro' },
    { id: 3, name: 'Free' },
];

const creditPack = {
    id: 1,
    name: 'Test Pack',
    description: null,
    credits: 100,
    bonus_credits: 0,
    price: 9.99,
    is_active: true,
    is_popular: false,
    sort_order: 0,
    plans: [{ id: 2, name: 'Pro' }],
};

describe('CreditPackForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pre-selects plan checkboxes matching creditPack.plans on edit', () => {
        mockUseFormReturn = createUseFormMock({ plan_ids: [2] });

        render(<CreditPackForm creditPack={creditPack} plans={plans} />);

        // Find the label containing "Pro" and check its nested checkbox
        const proLabel = screen.getByText('Pro').closest('label');
        const freeLabel = screen.getByText('Free').closest('label');

        const proCheckbox = within(proLabel!).getByRole('checkbox');
        const freeCheckbox = within(freeLabel!).getByRole('checkbox');

        expect(proCheckbox).toBeChecked();
        expect(freeCheckbox).not.toBeChecked();
    });

    it('credits/bonus-credits grid is responsive (stacks on mobile, 2-col from sm)', () => {
        mockUseFormReturn = createUseFormMock();

        render(<CreditPackForm creditPack={creditPack} plans={plans} />);

        const creditsLabel = screen.getByText('Credits (tokens) *');
        const grid = creditsLabel.closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('calls setData with updated plan_ids when a plan checkbox is toggled', async () => {
        mockUseFormReturn = createUseFormMock({ plan_ids: [2] });

        render(<CreditPackForm creditPack={creditPack} plans={plans} />);

        const freeLabel = screen.getByText('Free').closest('label');
        const freeCheckbox = within(freeLabel!).getByRole('checkbox');

        await userEvent.click(freeCheckbox);

        // The onCheckedChange handler should call setData('plan_ids', [2, 3])
        expect(mockUseFormReturn.setData).toHaveBeenCalledWith('plan_ids', [2, 3]);
    });
});
