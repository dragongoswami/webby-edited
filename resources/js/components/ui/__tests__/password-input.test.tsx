import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PasswordInput } from '../password-input';

describe('PasswordInput', () => {
    it('renders as type="password" by default', () => {
        render(
            <PasswordInput
                revealLabel="Show password"
                hideLabel="Hide password"
                data-testid="pw"
                value=""
                onChange={() => {}}
            />
        );
        expect(screen.getByTestId('pw')).toHaveAttribute('type', 'password');
    });

    it('toggles to type="text" and back to "password" on repeated clicks', () => {
        render(
            <PasswordInput
                revealLabel="Show password"
                hideLabel="Hide password"
                data-testid="pw"
                value=""
                onChange={() => {}}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
        expect(screen.getByTestId('pw')).toHaveAttribute('type', 'text');

        fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
        expect(screen.getByTestId('pw')).toHaveAttribute('type', 'password');
    });

    it('uses the passed reveal/hide labels as the toggle aria-label', () => {
        render(
            <PasswordInput
                revealLabel="Show secret"
                hideLabel="Hide secret"
                data-testid="pw"
                value=""
                onChange={() => {}}
            />
        );

        expect(screen.getByRole('button', { name: 'Show secret' })).toBeInTheDocument();
    });

    it('forwards typed input to onChange', () => {
        const onChange = vi.fn();
        render(
            <PasswordInput
                revealLabel="Show password"
                hideLabel="Hide password"
                data-testid="pw"
                value=""
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByTestId('pw'), { target: { value: 'secret123' } });
        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
