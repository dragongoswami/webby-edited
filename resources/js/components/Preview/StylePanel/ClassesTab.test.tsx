import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClassesTab } from './ClassesTab';

// The global test setup mocks useTranslation (identity-ish with :param interpolation).

describe('ClassesTab', () => {
    let onUpdateClasses: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onUpdateClasses = vi.fn();
    });

    const getInput = () => screen.getByPlaceholderText('e.g. rounded-lg') as HTMLInputElement;

    it('lists base classes (those without a breakpoint prefix) when no breakpoint', () => {
        render(
            <ClassesTab
                classes={['rounded-lg', 'md:flex', 'shadow']}
                breakpoint=""
                onUpdateClasses={onUpdateClasses}
            />
        );

        expect(screen.getByText('rounded-lg')).toBeInTheDocument();
        expect(screen.getByText('shadow')).toBeInTheDocument();
        // md:flex belongs to the md breakpoint, not the base view
        expect(screen.queryByText('md:flex')).not.toBeInTheDocument();
    });

    it('lists only the current breakpoint classes, stripping the prefix for display', () => {
        render(
            <ClassesTab
                classes={['rounded-lg', 'md:flex', 'md:gap-2']}
                breakpoint="md"
                onUpdateClasses={onUpdateClasses}
            />
        );

        // Prefix stripped in the chip label
        expect(screen.getByText('flex')).toBeInTheDocument();
        expect(screen.getByText('gap-2')).toBeInTheDocument();
        // Base class not shown at the md breakpoint
        expect(screen.queryByText('rounded-lg')).not.toBeInTheDocument();
    });

    it('shows the empty state when no classes match the breakpoint', () => {
        render(<ClassesTab classes={['md:flex']} breakpoint="" onUpdateClasses={onUpdateClasses} />);

        expect(screen.getByText('No classes at this breakpoint')).toBeInTheDocument();
    });

    it('adds a trimmed class (base, no prefix) via the + button and clears the input', () => {
        render(<ClassesTab classes={[]} breakpoint="" onUpdateClasses={onUpdateClasses} />);

        const input = getInput();
        fireEvent.change(input, { target: { value: '  rounded-xl  ' } });
        fireEvent.click(screen.getByRole('button', { name: '+' }));

        expect(onUpdateClasses).toHaveBeenCalledWith(['rounded-xl'], []);
        expect(input.value).toBe('');
    });

    it('prefixes an added class with the current breakpoint', () => {
        render(<ClassesTab classes={[]} breakpoint="lg" onUpdateClasses={onUpdateClasses} />);

        fireEvent.change(getInput(), { target: { value: 'hidden' } });
        fireEvent.click(screen.getByRole('button', { name: '+' }));

        expect(onUpdateClasses).toHaveBeenCalledWith(['lg:hidden'], []);
    });

    it('adds on Enter keydown', () => {
        render(<ClassesTab classes={[]} breakpoint="" onUpdateClasses={onUpdateClasses} />);

        const input = getInput();
        fireEvent.change(input, { target: { value: 'flex' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onUpdateClasses).toHaveBeenCalledWith(['flex'], []);
    });

    it('does nothing for an empty/whitespace-only input', () => {
        render(<ClassesTab classes={[]} breakpoint="" onUpdateClasses={onUpdateClasses} />);

        fireEvent.change(getInput(), { target: { value: '   ' } });
        fireEvent.click(screen.getByRole('button', { name: '+' }));

        expect(onUpdateClasses).not.toHaveBeenCalled();
    });

    it('does not re-add a class that already exists (dedup)', () => {
        render(<ClassesTab classes={['rounded-lg']} breakpoint="" onUpdateClasses={onUpdateClasses} />);

        const input = getInput();
        fireEvent.change(input, { target: { value: 'rounded-lg' } });
        fireEvent.click(screen.getByRole('button', { name: '+' }));

        expect(onUpdateClasses).not.toHaveBeenCalled();
        // Input is still cleared even when the class was a duplicate
        expect(input.value).toBe('');
    });

    it('dedup respects the breakpoint prefix (same base class at a new breakpoint IS added)', () => {
        render(<ClassesTab classes={['flex']} breakpoint="md" onUpdateClasses={onUpdateClasses} />);

        fireEvent.change(getInput(), { target: { value: 'flex' } });
        fireEvent.click(screen.getByRole('button', { name: '+' }));

        // base 'flex' exists but 'md:flex' does not — so it is added
        expect(onUpdateClasses).toHaveBeenCalledWith(['md:flex'], []);
    });

    it('removes a class via its X button (passing the full prefixed class)', () => {
        render(
            <ClassesTab
                classes={['md:flex', 'md:gap-2']}
                breakpoint="md"
                onUpdateClasses={onUpdateClasses}
            />
        );

        // The label lives in an inner <span class="font-mono">; the chip (with the
        // X button) is its parent span.
        const chip = screen.getByText('flex').parentElement as HTMLElement;
        fireEvent.click(within(chip).getByRole('button'));

        // The removal passes the FULL prefixed class, not the stripped label
        expect(onUpdateClasses).toHaveBeenCalledWith([], ['md:flex']);
    });
});
