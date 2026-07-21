import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BreakpointBar } from './BreakpointBar';
import { BREAKPOINTS, BREAKPOINT_LABELS } from './tailwind-data';

describe('BreakpointBar', () => {
    it('renders one button per BREAKPOINTS entry, labeled from BREAKPOINT_LABELS', () => {
        render(<BreakpointBar active="" onChange={vi.fn()} classes={[]} />);

        BREAKPOINTS.forEach(bp => {
            expect(screen.getByText(BREAKPOINT_LABELS[bp])).toBeInTheDocument();
        });
    });

    it('highlights the active breakpoint button', () => {
        render(<BreakpointBar active="md" onChange={vi.fn()} classes={[]} />);

        expect(screen.getByText('MD').className).toMatch(/bg-primary/);
        expect(screen.getByText('Base').className).not.toMatch(/bg-primary/);
        expect(screen.getByText('SM').className).not.toMatch(/bg-primary/);
    });

    it('clicking a breakpoint button calls onChange with its raw value', () => {
        const onChange = vi.fn();
        render(<BreakpointBar active="" onChange={onChange} classes={[]} />);

        fireEvent.click(screen.getByText('LG'));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('lg');
    });

    it('clicking the Base button calls onChange with the empty string', () => {
        const onChange = vi.fn();
        render(<BreakpointBar active="md" onChange={onChange} classes={[]} />);

        fireEvent.click(screen.getByText('Base'));

        expect(onChange).toHaveBeenCalledWith('');
    });

    it('the "has classes" dot is never rendered on the Base button, even when classes are present', () => {
        const { container } = render(
            <BreakpointBar active="" onChange={vi.fn()} classes={['md:flex', 'text-lg']} />,
        );

        const baseButton = screen.getByText('Base').closest('button') as HTMLElement;
        expect(baseButton.querySelector('span')).not.toBeInTheDocument();
        expect(container).toBeTruthy();
    });

    it('the "has classes" dot renders on a non-base breakpoint button when a class matches its prefix', () => {
        render(<BreakpointBar active="" onChange={vi.fn()} classes={['md:flex']} />);

        const mdButton = screen.getByText('MD').closest('button') as HTMLElement;
        expect(mdButton.querySelector('span')).toBeInTheDocument();
    });

    it('the "has classes" dot is absent on a non-base breakpoint button when no class matches its prefix', () => {
        render(<BreakpointBar active="" onChange={vi.fn()} classes={['md:flex']} />);

        const lgButton = screen.getByText('LG').closest('button') as HTMLElement;
        expect(lgButton.querySelector('span')).not.toBeInTheDocument();
    });

    it('a base (unprefixed) class does not trigger the dot on any breakpoint button', () => {
        render(<BreakpointBar active="" onChange={vi.fn()} classes={['flex', 'text-lg']} />);

        BREAKPOINTS.filter(bp => bp !== '').forEach(bp => {
            const button = screen.getByText(BREAKPOINT_LABELS[bp]).closest('button') as HTMLElement;
            expect(button.querySelector('span')).not.toBeInTheDocument();
        });
    });
});
