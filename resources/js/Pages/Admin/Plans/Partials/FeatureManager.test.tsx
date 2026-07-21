import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FeatureManager, { PlanFeature } from './FeatureManager';

describe('FeatureManager touch-visible reveal + a11y (mobile fixes Task 12)', () => {
    it('labels the feature-name input via an associated Label', () => {
        render(<FeatureManager features={[]} onChange={vi.fn()} />);
        expect(screen.getByLabelText('Feature name')).toBeInTheDocument();
    });

    it('the add-feature button is h-9 w-9 with an aria-label', () => {
        render(<FeatureManager features={[]} onChange={vi.fn()} />);
        const addButton = screen.getByRole('button', { name: 'Add feature' });
        expect(addButton.className).toContain('h-9');
        expect(addButton.className).toContain('w-9');
    });

    it('the remove-feature button is touch-visible (h-9 w-9, aria-label, reveal standard)', () => {
        const features: PlanFeature[] = [{ name: 'Custom domains', included: true }];
        render(<FeatureManager features={features} onChange={vi.fn()} />);

        const removeButton = screen.getByRole('button', { name: 'Remove feature' });
        expect(removeButton.className).toContain('h-9');
        expect(removeButton.className).toContain('w-9');
        expect(removeButton.className).toContain('opacity-100');
        expect(removeButton.className).toContain('md:opacity-0');
        expect(removeButton.className).toContain('md:group-hover:opacity-100');
        expect(removeButton.className).toContain('group-focus-within:opacity-100');
    });

    it('clicking the labeled remove-feature button removes that feature', () => {
        const onChange = vi.fn();
        const features: PlanFeature[] = [
            { name: 'Custom domains', included: true },
            { name: 'Priority support', included: false },
        ];
        render(<FeatureManager features={features} onChange={onChange} />);

        fireEvent.click(screen.getAllByRole('button', { name: 'Remove feature' })[0]);
        expect(onChange).toHaveBeenCalledWith([{ name: 'Priority support', included: false }]);
    });
});
