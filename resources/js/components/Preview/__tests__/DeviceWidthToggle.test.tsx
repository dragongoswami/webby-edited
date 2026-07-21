import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DeviceWidthToggle from '../DeviceWidthToggle';

describe('DeviceWidthToggle', () => {
    it('renders three buttons with the expected aria-labels', () => {
        render(<DeviceWidthToggle value="full" onChange={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Phone preview' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tablet preview' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Full width preview' })).toBeInTheDocument();
    });

    it('hides itself below md breakpoint via root class', () => {
        const { container } = render(<DeviceWidthToggle value="full" onChange={vi.fn()} />);

        expect(container.firstChild).toHaveClass('hidden');
        expect(container.firstChild).toHaveClass('md:flex');
    });

    it('marks the active device button aria-pressed=true and others false', () => {
        render(<DeviceWidthToggle value="phone" onChange={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Phone preview' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Tablet preview' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'Full width preview' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onChange("phone") when the Phone button is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<DeviceWidthToggle value="full" onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: 'Phone preview' }));

        expect(onChange).toHaveBeenCalledWith('phone');
    });

    it('calls onChange("tablet") when the Tablet button is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<DeviceWidthToggle value="full" onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: 'Tablet preview' }));

        expect(onChange).toHaveBeenCalledWith('tablet');
    });

    it('calls onChange("full") when the Full button is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<DeviceWidthToggle value="phone" onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: 'Full width preview' }));

        expect(onChange).toHaveBeenCalledWith('full');
    });

    it('uses a 36px touch-target floor for each button', () => {
        render(<DeviceWidthToggle value="full" onChange={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Phone preview' }).className).toContain('h-9');
        expect(screen.getByRole('button', { name: 'Phone preview' }).className).toContain('w-9');
    });
});
